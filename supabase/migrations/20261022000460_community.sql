-- Community (plan P4): publish a release (unlisted or public), share links,
-- fork, search, device matching and download counts. The RPCs are the ones
-- plan A4 defined beside the library tables; record_download comes from A5.
-- Unlisted links need the Vault secret `share_secret` (seed.sql locally;
-- once per environment: select vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'share_secret');).

-- ── Share links: token = HMAC(vault secret, item:rev); only sha256(token) stored ─
create function private.share_token(p_item uuid, p_rev integer) returns text
language plpgsql stable security definer set search_path = '' as $$
declare
  v_secret text := (select s.decrypted_secret from vault.decrypted_secrets s where s.name = 'share_secret');
begin
  if v_secret is null then
    raise exception 'share_secret_missing' using errcode = 'P0001';
  end if;
  return encode(extensions.hmac(p_item::text || ':' || p_rev::text, v_secret, 'sha256'), 'hex');
end;
$$;

create function private.share_hash(p_token text) returns text
language sql immutable set search_path = '' as $$
  select encode(extensions.digest(p_token, 'sha256'), 'hex');
$$;

-- Stamp the head version as a release and expose it as unlisted/public.
create function public.publish_item(p_item uuid, p_visibility text, p_license text, p_changelog text)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_row public.library_items;
  v_no  integer;
begin
  select * into v_row from public.library_items i
   where i.id = p_item and i.owner_id = v_uid and i.deleted_at is null
   for update;
  if not found or v_row.type = 'backup' then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if p_visibility not in ('unlisted', 'public') then
    raise exception 'invalid_visibility' using errcode = '22023';
  end if;
  if v_row.forked_license = 'CC-BY-SA-4.0' and p_license is distinct from 'CC-BY-SA-4.0' then
    raise exception 'license_must_be_share_alike' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.users p where p.id = v_uid and p.username is not null) then
    raise exception 'username_required' using errcode = 'P0001';
  end if;
  if v_row.type = 'device' and not private.plan_allows('builder') then
    raise exception 'feature_required' using errcode = 'P0001', hint = 'builder';
  end if;
  perform private.hit_rate_limit('publish', 20, interval '1 day');
  if p_visibility = 'public' and v_row.visibility <> 'public' then
    perform private.check_item_quota(v_uid, 'public_items');
  end if;
  select v.release_no into v_no from public.library_item_versions v
   where v.item_id = p_item and v.version = v_row.head_version;
  if v_no is null then
    select coalesce(max(v.release_no), 0) + 1 into v_no from public.library_item_versions v where v.item_id = p_item;
    update public.library_item_versions
       set release_no = v_no, changelog = left(coalesce(p_changelog, ''), 2000), license = p_license
     where item_id = p_item and version = v_row.head_version;
  end if;
  update public.library_items
     set visibility = p_visibility, license = p_license, published_version = v_row.head_version,
         published_at = coalesce(published_at, now()),
         share_hash = case when p_visibility = 'unlisted'
                           then private.share_hash(private.share_token(p_item, share_rev))
                           else share_hash end
   where id = p_item;
  delete from public.library_item_versions v                          -- keep the last 50 releases
   where v.item_id = p_item and v.release_no <= v_no - 50 and v.version <> v_row.head_version;
  return v_no;
end;
$$;

create function public.unpublish_item(p_item uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_row public.library_items;
begin
  select * into v_row from public.library_items i
   where i.id = p_item and i.owner_id = v_uid and i.deleted_at is null
   for update;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if v_row.visibility = 'public' and v_row.type in ('device', 'config') then
    perform private.check_item_quota(v_uid, 'cloud_private_items');
  end if;
  update public.library_items
     set visibility = 'private', share_rev = share_rev + 1, share_hash = null   -- old link dies
   where id = p_item;
end;
$$;

-- Owner: current share token (to copy the link again), or a fresh one on rotate.
create function public.get_share_token(p_item uuid) returns text
language sql stable security definer set search_path = '' as $$
  select private.share_token(i.id, i.share_rev)
    from public.library_items i
   where i.id = p_item and i.owner_id = (select auth.uid()) and i.share_hash is not null;
$$;

create function public.rotate_share_token(p_item uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_rev integer;
begin
  update public.library_items
     set share_rev = share_rev + 1,
         share_hash = private.share_hash(private.share_token(id, share_rev + 1))
   where id = p_item and owner_id = (select auth.uid()) and share_hash is not null
  returning share_rev into v_rev;
  if v_rev is null then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  return private.share_token(p_item, v_rev);
end;
$$;

-- Anyone with the token (anon allowed): the published release.
create function public.get_shared_item(p_token text)
returns table (id uuid, type text, name text, summary text, license text,
               owner_username text, release_no integer, document jsonb)
language sql stable security definer set search_path = '' as $$
  select i.id, i.type, i.name, i.summary, i.license, p.username::text, v.release_no, v.document
    from public.library_items i
    join public.users p on p.id = i.owner_id
    join public.library_item_versions v on v.item_id = i.id and v.version = i.published_version
   where i.share_hash = private.share_hash(p_token)
     and i.visibility in ('unlisted', 'public') and i.moderation = 'ok' and i.deleted_at is null;
$$;

-- Copy a public (or unlisted + token) release into the caller's private library.
create function public.fork_item(p_item uuid, p_token text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_src public.library_items;
  v_doc jsonb;
  v_new uuid;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  select i.* into v_src from public.library_items i
   where i.id = p_item and i.deleted_at is null and i.moderation = 'ok'
     and (i.visibility = 'public'
          or (i.visibility = 'unlisted' and i.share_hash = private.share_hash(coalesce(p_token, ''))));
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if v_src.type = 'device' and not private.plan_allows('builder') then
    raise exception 'feature_required' using errcode = 'P0001', hint = 'builder';
  end if;
  select v.document into v_doc from public.library_item_versions v
   where v.item_id = p_item and v.version = v_src.published_version;
  perform private.check_item_quota(v_uid, private.quota_feature(v_src.type));
  perform private.check_storage(v_uid, octet_length(v_doc::text));
  insert into public.library_items (owner_id, type, name, summary, description, tags, meta, identifiers,
                            device_id, forked_from, forked_release, forked_license)
  select v_uid, v_src.type, v_src.name, v_src.summary, v_src.description, v_src.tags, v_src.meta,
         v_src.identifiers, v_src.device_id, v_src.id, v.release_no, v_src.license
    from public.library_item_versions v
   where v.item_id = p_item and v.version = v_src.published_version
  returning id into v_new;
  insert into public.library_item_versions (item_id, version, document) values (v_new, 1, v_doc);
  update public.library_items set forks_count = forks_count + 1 where id = p_item;
  return v_new;
end;
$$;

-- p_filters: {type?, device_kind?, target?, device_id?, tag?}; p_sort: new | stars | downloads.
create function public.search_items(p_query text, p_filters jsonb, p_sort text, p_page integer)
returns table (id uuid, type text, name text, summary text, tags text[], license text,
               owner_username text, published_at timestamptz, stars integer, downloads integer,
               device_kind text, target text)
language sql stable security invoker set search_path = '' as $$
  select i.id, i.type, i.name, i.summary, i.tags, i.license, p.username::text, i.published_at,
         i.stars_count, i.downloads_count,
         coalesce(i.meta ->> 'device_kind', d.meta ->> 'device_kind'), i.meta ->> 'target'
    from public.library_items i
    join public.users p on p.id = i.owner_id
    left join public.library_items d on d.id = i.device_id
   where i.visibility = 'public' and i.moderation = 'ok' and i.deleted_at is null
     and (p_filters ->> 'type' is null or i.type = p_filters ->> 'type')
     and (p_filters ->> 'device_kind' is null
          or coalesce(i.meta ->> 'device_kind', d.meta ->> 'device_kind') = p_filters ->> 'device_kind')
     and (p_filters ->> 'target' is null or i.meta ->> 'target' = p_filters ->> 'target')
     and (p_filters ->> 'device_id' is null
          or i.id = (p_filters ->> 'device_id')::uuid or i.device_id = (p_filters ->> 'device_id')::uuid)
     and (p_filters ->> 'tag' is null or i.tags @> array[p_filters ->> 'tag'])
     and (coalesce(p_query, '') = ''
          or i.search @@ websearch_to_tsquery('simple', p_query)
          or i.name operator(extensions.%) p_query)
   order by
     case when p_sort = 'stars'     then i.stars_count     end desc nulls last,
     case when p_sort = 'downloads' then i.downloads_count end desc nulls last,
     i.published_at desc, i.id
   limit 24 offset greatest(coalesce(p_page, 0), 0) * 24;
$$;

-- Fingerprint match for a connected device. p_identifiers: ['scheme:value', …]
create function public.match_devices(p_identifiers jsonb)
returns table (device_id uuid, score integer)
language sql stable security invoker set search_path = '' as $$
  with q as (
    select distinct lower(t.x) as ident
      from jsonb_array_elements_text(p_identifiers) as t (x)
     where not exists (select 1 from public.lookups g
                        where g.category = 'generic_usb' and 'usb:' || g.key = lower(t.x))
  )
  select i.id,
         (sum((s.data ->> 'weight')::integer) + case when bool_or(i.verified) then 25 else 0 end)::integer
    from public.library_items i
    join q on q.ident = any (i.identifiers)
    join public.lookups s on s.category = 'identifier_scheme' and s.key = split_part(q.ident, ':', 1)
   where i.type = 'device' and i.deleted_at is null
     and i.identifiers && (select array_agg(q2.ident) from q as q2)
   group by i.id
   order by 2 desc
   limit 20;
$$;

-- One counted download per user per item per day.
create function public.record_download(p_item uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.can_read_item(p_item) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if private.first_in_window('download:' || p_item::text, interval '1 day') then
    update public.library_items set downloads_count = downloads_count + 1 where id = p_item;
  end if;
end;
$$;

-- device items may carry an image in the device-images bucket under the
-- owner's folder: {uid}/{item_id}/{file}.
create or replace function private.check_image_path(p_meta jsonb) returns void
language plpgsql stable set search_path = '' as $$
begin
  if p_meta ? 'image_path'
     and (p_meta ->> 'image_path') !~ ('^' || (select auth.uid())::text || '/[0-9a-f-]{36}/[A-Za-z0-9._-]{1,80}$') then
    raise exception 'invalid_meta' using errcode = '22023', hint = 'image_path';
  end if;
end;
$$;

-- check_meta, as in migration 4 plus the image path check.
create or replace function private.check_meta(p_type text, p_meta jsonb, p_identifiers text[], p_device uuid)
returns void language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.check_image_path(p_meta);
  if p_device is not null and not private.can_read_item(p_device) then
    raise exception 'device_not_found' using errcode = 'P0002';
  end if;
  if p_type <> 'device' and cardinality(p_identifiers) > 0 then
    raise exception 'invalid_identifier' using errcode = '22023';
  end if;
  if p_type = 'backup' and coalesce(p_meta ->> 'device_key', '') !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid_meta' using errcode = '22023', hint = 'device_key';
  end if;
  if p_type <> 'device' then
    return;
  end if;
  if private.lookup('device_kind', p_meta ->> 'device_kind') is null
     or private.lookup('device_form', p_meta ->> 'form') is null then
    raise exception 'invalid_meta' using errcode = '22023', hint = 'device_kind/form';
  end if;
  if exists (select 1
               from unnest(p_identifiers) as t (ident)
               left join public.lookups s
                 on s.category = 'identifier_scheme' and s.key = split_part(t.ident, ':', 1)
              where s.key is null
                 or t.ident <> lower(t.ident)
                 or substr(t.ident, length(s.key) + 2) !~ (s.data ->> 'pattern')) then
    raise exception 'invalid_identifier' using errcode = '22023';
  end if;
end;
$$;

revoke execute on function
  public.publish_item(uuid, text, text, text), public.unpublish_item(uuid),
  public.get_share_token(uuid), public.rotate_share_token(uuid),
  public.fork_item(uuid, text), public.record_download(uuid)
  from anon;
grant execute on function
  public.publish_item(uuid, text, text, text), public.unpublish_item(uuid),
  public.get_share_token(uuid), public.rotate_share_token(uuid),
  public.fork_item(uuid, text), public.record_download(uuid)
  to authenticated;
grant execute on function
  public.get_shared_item(text), public.search_items(text, jsonb, text, integer),
  public.match_devices(jsonb)
  to anon, authenticated;
