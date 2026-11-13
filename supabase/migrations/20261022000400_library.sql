-- Cloud library (plan P3): items + version history, owner-only writes through
-- RPCs, quotas from the plan, and the sync feed. The table carries the
-- publishing / sharing / fork columns already; their RPCs (publish, shares,
-- fork, search, device matching, collections) land with P4/P5, git links with P10.

-- ── Lookup rows for the library ─────────────────────────────────────────────
insert into public.lookups (category, key, data) values
  ('device_kind', 'keyboard', '{}'), ('device_kind', 'mouse', '{}'),
  ('device_kind', 'joystick', '{}'), ('device_kind', 'dongle', '{}'),
  ('device_form', 'keyboard', '{}'), ('device_form', 'macropad', '{}'), ('device_form', 'mouse', '{}'),
  ('device_form', 'gamepad', '{}'),  ('device_form', 'flightstick', '{}'),
  ('document_kind', 'device:remappr.keymap', '{}'),          -- builder board (geometry/matrix/pins)
  ('document_kind', 'device:remappr.device-layout', '{}'),   -- mouse / joystick shell + controls
  ('document_kind', 'config:remappr.keymap', '{}'),
  ('document_kind', 'config:remappr.device', '{}'),
  ('document_kind', 'collection:remappr.collection', '{}'),
  ('document_kind', 'backup:remappr.backup', '{}'),
  ('identifier_scheme', 'vial_uid',      '{"weight": 100, "pattern": "^[0-9a-f]{16}$"}'),
  ('identifier_scheme', 'remappr_model', '{"weight": 100, "pattern": "^[a-z0-9._-]{1,64}$"}'),
  ('identifier_scheme', 'qmk_keyboard',  '{"weight": 80,  "pattern": "^[a-z0-9_/-]{1,128}$"}'),
  ('identifier_scheme', 'via_name',      '{"weight": 60,  "pattern": "^.{1,128}$"}'),
  ('identifier_scheme', 'usb',           '{"weight": 50,  "pattern": "^[0-9a-f]{4}:[0-9a-f]{4}$"}'),
  ('identifier_scheme', 'layout_hash',   '{"weight": 40,  "pattern": "^[0-9a-f]{32}$"}'),
  ('identifier_scheme', 'zmk_name',      '{"weight": 30,  "pattern": "^.{1,64}$"}'),
  ('identifier_scheme', 'ble_name',      '{"weight": 20,  "pattern": "^.{1,64}$"}'),
  ('generic_usb', '1d50:615e', '{"note": "ZMK default VID:PID — shared by most ZMK boards"}');

-- ── items: every cloud library entry ─────────────────────────────────────────
create table public.library_items (
  id                uuid primary key default gen_random_uuid(),
  owner_id          uuid not null references public.users (id) on delete cascade,
  type              text not null check (type in ('device', 'config', 'collection', 'backup')),
  client_id         uuid,                                   -- local library id (idempotent upload)
  name              text not null check (char_length(name) between 1 and 120),
  summary           text not null default '' check (char_length(summary) <= 280),
  description       text not null default '' check (char_length(description) <= 8000),
  tags              text[] not null default '{}' check (cardinality(tags) <= 12),
  meta              jsonb not null default '{}'::jsonb
                    check (jsonb_typeof(meta) = 'object' and pg_column_size(meta) <= 8192),
  identifiers       text[] not null default '{}' check (cardinality(identifiers) <= 32),  -- 'scheme:value'
  device_id         uuid references public.library_items (id) on delete set null,
  visibility        text not null default 'private' check (visibility in ('private', 'unlisted', 'public')),
  license           text check (license in ('CC0-1.0', 'CC-BY-4.0', 'CC-BY-SA-4.0', 'MIT')),
  head_version      integer not null default 1,
  published_version integer,
  published_at      timestamptz,
  share_rev         integer not null default 0,
  share_hash        text unique,                            -- sha256(HMAC token); token never stored
  forked_from       uuid references public.library_items (id) on delete set null,
  forked_release    integer,
  forked_license    text,
  verified          boolean not null default false,         -- admin-curated device
  moderation        text not null default 'ok' check (moderation in ('ok', 'flagged', 'hidden')),
  stars_count       integer not null default 0,
  forks_count       integer not null default 0,
  downloads_count   integer not null default 0,
  comments_count    integer not null default 0,
  search            tsvector,
  deleted_at        timestamptz,                            -- sync tombstone, purged after 30 d
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (owner_id, client_id),
  constraint backups_stay_private check (type <> 'backup' or visibility = 'private'),
  constraint published_needs_release
    check (visibility = 'private' or (license is not null and published_version is not null))
);
create index items_owner_updated on public.library_items (owner_id, updated_at desc);
create unique index items_backup_device on public.library_items (owner_id, (meta ->> 'device_key'))
  where type = 'backup' and deleted_at is null;
create index items_device_link on public.library_items (device_id) where device_id is not null;
create index items_identifiers on public.library_items using gin (identifiers)
  where type = 'device' and deleted_at is null;
create index items_public_recent on public.library_items (published_at desc)
  where visibility = 'public' and moderation = 'ok' and deleted_at is null;
create index items_public_search on public.library_items using gin (search)
  where visibility = 'public' and moderation = 'ok' and deleted_at is null;
create index items_public_name_trgm on public.library_items using gin (name extensions.gin_trgm_ops)
  where visibility = 'public' and moderation = 'ok' and deleted_at is null;
create index items_public_kind on public.library_items ((meta ->> 'device_kind'))
  where visibility = 'public' and moderation = 'ok' and deleted_at is null;

-- Tags + search + updated_at, skipped for counter/moderation-only updates.
create function private.items_before_write() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'UPDATE'
     and (new.name, new.summary, new.description, new.tags, new.meta, new.visibility,
          new.head_version, new.deleted_at, new.identifiers, new.device_id)
         is not distinct from
         (old.name, old.summary, old.description, old.tags, old.meta, old.visibility,
          old.head_version, old.deleted_at, old.identifiers, old.device_id) then
    return new;
  end if;
  if exists (select 1 from unnest(new.tags) t where t !~* '^[a-z0-9][a-z0-9+-]{0,23}$') then
    raise exception 'invalid_tag' using errcode = '22023';
  end if;
  new.tags := array(select distinct lower(t) from unnest(new.tags) t);
  new.search :=
       setweight(to_tsvector('simple', new.name), 'A')
    || setweight(to_tsvector('simple', array_to_string(new.tags, ' ')), 'B')
    || setweight(to_tsvector('simple', new.summary), 'B')
    || setweight(to_tsvector('simple', coalesce(new.meta ->> 'manufacturer', '') || ' '
                                       || coalesce(new.meta ->> 'model', '')), 'B')
    || setweight(to_tsvector('simple', left(new.description, 2000)), 'C');
  new.updated_at := now();
  return new;
end;
$$;
create trigger items_before_write before insert or update on public.library_items
  for each row execute function private.items_before_write();

-- ── library_item_versions: history; stamped rows are published releases ─────────────
create table public.library_item_versions (
  item_id    uuid not null references public.library_items (id) on delete cascade,
  version    integer not null,
  document   jsonb not null check (jsonb_typeof(document) = 'object'),
  size_bytes integer not null check (size_bytes <= 524288),       -- raw JSON ≤ 512 KB
  release_no integer,                                           -- set on publish
  kind       text not null default 'autosave' check (kind in ('autosave', 'checkpoint', 'github')),
  message    text not null default '' check (char_length(message) <= 500),
  git_commit_sha text check (git_commit_sha ~ '^[0-9a-f]{40}$'),
  changelog  text not null default '' check (char_length(changelog) <= 2000),
  license    text,
  created_at timestamptz not null default now(),
  primary key (item_id, version),
  unique (item_id, release_no)
);

create function private.set_size_bytes() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.size_bytes := octet_length(new.document::text);
  return new;
end;
$$;
create trigger a_size before insert on public.library_item_versions
  for each row execute function private.set_size_bytes();

-- ── Access helpers (policies call these → executable by callers) ────────────
create function private.owns_item(p_item uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.library_items i where i.id = p_item and i.owner_id = (select auth.uid()));
$$;

create function private.can_read_item(p_item uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.library_items i
                  where i.id = p_item and i.deleted_at is null
                    and (i.owner_id = (select auth.uid())
                         or (i.visibility = 'public' and i.moderation = 'ok')));
$$;
grant execute on function private.owns_item(uuid), private.can_read_item(uuid) to anon, authenticated;

create function private.can_write_item(p_item uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.library_items i
                  where i.id = p_item and i.deleted_at is null
                    and i.owner_id = (select auth.uid())
                    and (i.type <> 'device' or private.plan_allows('builder')));
$$;

-- ── Validation (client derives meta via firmware describeDocument) ──────────
create function private.check_document(p_type text, p_doc jsonb) returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if jsonb_typeof(p_doc) is distinct from 'object'
     or private.lookup('document_kind', p_type || ':' || coalesce(p_doc ->> 'kind', '')) is null then
    raise exception 'document_kind_mismatch' using errcode = '22023';
  end if;
  if p_type = 'collection' and jsonb_array_length(coalesce(p_doc -> 'items', '[]'::jsonb)) > 200 then
    raise exception 'quota_exceeded' using errcode = 'P0001', hint = 'collection_items';
  end if;
end;
$$;

create function private.check_meta(p_type text, p_meta jsonb, p_identifiers text[], p_device uuid)
returns void language plpgsql stable security definer set search_path = '' as $$
begin
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

-- ── Quotas ───────────────────────────────────────────────────────────────────
create function private.quota_feature(p_type text) returns text
language sql immutable set search_path = '' as $$
  select case p_type
           when 'backup'     then 'cloud_device_backups'
           when 'collection' then 'collections'
           else 'cloud_private_items'
         end;
$$;

create function private.check_item_quota(p_user uuid, p_feature text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_count integer;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user::text, 0));
  select count(*) into v_count
    from public.library_items i
   where i.owner_id = p_user and i.deleted_at is null
     and case p_feature
           when 'public_items'         then i.visibility = 'public'
           when 'cloud_device_backups' then i.type = 'backup'
           when 'collections'          then i.type = 'collection'
           else i.type in ('device', 'config') and i.visibility <> 'public'
         end;
  if v_count >= private.plan_limit(p_user, p_feature) then
    raise exception 'quota_exceeded' using errcode = 'P0001', hint = p_feature;
  end if;
end;
$$;

create function private.storage_bytes(p_user uuid) returns bigint
language sql stable security definer set search_path = '' as $$
  select coalesce(sum(v.size_bytes), 0)::bigint
    from public.library_item_versions v
    join public.library_items i on i.id = v.item_id
   where i.owner_id = p_user;
$$;

create function private.check_storage(p_user uuid, p_extra bigint) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if private.storage_bytes(p_user) + p_extra
     > private.plan_limit(p_user, 'cloud_storage_mb')::bigint * 1048576 then
    raise exception 'quota_exceeded' using errcode = 'P0001', hint = 'cloud_storage_mb';
  end if;
end;
$$;

-- ── Write RPCs ───────────────────────────────────────────────────────────────
-- p_item: {client_id?, type, name, summary?, description?, tags?, meta?, identifiers?, device_id?}
create function public.create_item(p_item jsonb, p_document jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_uid    uuid := (select auth.uid());
  v_type   text := p_item ->> 'type';
  v_client uuid := (p_item ->> 'client_id')::uuid;
  v_meta   jsonb := coalesce(p_item -> 'meta', '{}'::jsonb);
  v_ids    text[] := array(select jsonb_array_elements_text(coalesce(p_item -> 'identifiers', '[]'::jsonb)));
  v_device uuid := (p_item ->> 'device_id')::uuid;
  v_id     uuid;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  select i.id into v_id from public.library_items i where i.owner_id = v_uid and i.client_id = v_client;
  if v_id is not null then
    return v_id;                                             -- idempotent re-upload
  end if;
  if v_type = 'device' and not private.plan_allows('builder') then
    raise exception 'feature_required' using errcode = 'P0001', hint = 'builder';
  end if;
  perform private.check_document(v_type, p_document);
  perform private.check_meta(v_type, v_meta, v_ids, v_device);
  perform private.check_item_quota(v_uid, private.quota_feature(v_type));
  perform private.check_storage(v_uid, octet_length(p_document::text));
  insert into public.library_items (owner_id, client_id, type, name, summary, description, tags,
                            meta, identifiers, device_id)
  values (v_uid, v_client, v_type, p_item ->> 'name', coalesce(p_item ->> 'summary', ''),
          coalesce(p_item ->> 'description', ''),
          array(select jsonb_array_elements_text(coalesce(p_item -> 'tags', '[]'::jsonb))),
          v_meta, v_ids, v_device)
  returning id into v_id;
  insert into public.library_item_versions (item_id, version, document) values (v_id, 1, p_document);
  return v_id;
end;
$$;

-- p_changes: {document?, kind? (autosave|checkpoint|github), message?, name?, summary?, description?,
--             tags?, meta?, identifiers?, device_id?}
-- Returns the head version. A document equal to the head is a no-op (no new version).
create function public.save_item(p_item uuid, p_base_version integer, p_changes jsonb)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  v_uid  uuid := (select auth.uid());
  v_row  public.library_items;
  v_doc  jsonb := p_changes -> 'document';
  v_ids  text[];
  v_dev  uuid;
  v_next integer;
begin
  select * into v_row from public.library_items i where i.id = p_item for update;
  if not found or not private.can_write_item(p_item) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  v_ids := case when p_changes ? 'identifiers'
                then array(select jsonb_array_elements_text(p_changes -> 'identifiers'))
                else v_row.identifiers end;
  v_dev := case when p_changes ? 'device_id' then (p_changes ->> 'device_id')::uuid else v_row.device_id end;
  perform private.check_meta(v_row.type, coalesce(p_changes -> 'meta', v_row.meta), v_ids, v_dev);
  if v_doc is not null and v_doc is distinct from (
       select v.document from public.library_item_versions v
        where v.item_id = p_item and v.version = v_row.head_version) then
    if v_row.head_version <> p_base_version then
      raise exception 'version_conflict' using errcode = 'P0001';
    end if;
    perform private.check_document(v_row.type, v_doc);
    perform private.check_storage(v_uid, octet_length(v_doc::text));
    v_next := v_row.head_version + 1;
    insert into public.library_item_versions (item_id, version, document, kind, message)
    values (p_item, v_next, v_doc, coalesce(p_changes ->> 'kind', 'autosave'),
            left(coalesce(p_changes ->> 'message', ''), 500));
    delete from public.library_item_versions v
     where v.item_id = p_item and v.release_no is null and v.kind = 'autosave'
       and v.version <= v_next - 1 - private.plan_limit(v_uid, 'revision_history');
  end if;
  update public.library_items set
    name         = coalesce(p_changes ->> 'name', name),
    summary      = coalesce(p_changes ->> 'summary', summary),
    description  = coalesce(p_changes ->> 'description', description),
    tags         = case when p_changes ? 'tags'
                        then array(select jsonb_array_elements_text(p_changes -> 'tags')) else tags end,
    meta         = coalesce(p_changes -> 'meta', meta),
    identifiers  = v_ids,
    device_id    = v_dev,
    head_version = coalesce(v_next, head_version)
  where id = p_item;
  return coalesce(v_next, v_row.head_version);
end;
$$;

create function public.delete_item(p_item uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.library_items
     set deleted_at = now(), visibility = 'private', share_hash = null
   where id = p_item and owner_id = (select auth.uid()) and deleted_at is null;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
end;
$$;

-- Owner backup upsert per physical unit (last write wins; versions keep history).
-- p_backup: {device_key, device_name, firmware, device_id?, document}
create function public.save_device_backup(p_backup jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_id   uuid;
  v_head integer;
begin
  select i.id, i.head_version into v_id, v_head
    from public.library_items i
   where i.owner_id = (select auth.uid()) and i.type = 'backup' and i.deleted_at is null
     and i.meta ->> 'device_key' = p_backup ->> 'device_key';
  if v_id is null then
    return public.create_item(
      jsonb_build_object('type', 'backup', 'name', p_backup ->> 'device_name',
                         'device_id', p_backup -> 'device_id',
                         'meta', jsonb_build_object('device_key', p_backup ->> 'device_key',
                                                    'firmware', p_backup ->> 'firmware')),
      p_backup -> 'document');
  end if;
  perform public.save_item(v_id, v_head, jsonb_build_object('document', p_backup -> 'document',
                                                            'name', p_backup ->> 'device_name'));
  return v_id;
end;
$$;

-- ── Read RPCs (invoker → RLS applies) ────────────────────────────────────────
create function public.sync_pull(p_since timestamptz)
returns table (id uuid, client_id uuid, type text, name text, head_version integer,
               updated_at timestamptz, deleted_at timestamptz)
language sql stable security invoker set search_path = '' as $$
  select i.id, i.client_id, i.type, i.name, i.head_version, i.updated_at, i.deleted_at
    from public.library_items i
   where i.owner_id = (select auth.uid())
     and i.updated_at > coalesce(p_since, '-infinity'::timestamptz)
   order by i.updated_at
   limit 500;
$$;

create function public.my_usage() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'cloud_private_items',  count(*) filter (where i.type in ('device', 'config') and i.visibility <> 'public'),
    'public_items',         count(*) filter (where i.visibility = 'public'),
    'collections',          count(*) filter (where i.type = 'collection'),
    'cloud_device_backups', count(*) filter (where i.type = 'backup'),
    'storage_bytes',        private.storage_bytes((select auth.uid())))
    from public.library_items i
   where i.owner_id = (select auth.uid()) and i.deleted_at is null;
$$;

-- ── RLS + grants: reads via policies, writes only via the RPCs above ────────
alter table public.library_items         enable row level security;
alter table public.library_item_versions enable row level security;
revoke all on public.library_items, public.library_item_versions from anon, authenticated;
grant select on public.library_items, public.library_item_versions to anon, authenticated;

create policy items_read on public.library_items for select to anon, authenticated
  using ((visibility = 'public' and moderation = 'ok' and deleted_at is null)
         or owner_id = (select auth.uid()));
create policy versions_read on public.library_item_versions for select to anon, authenticated
  using (private.owns_item(item_id)
         or (release_no is not null and private.can_read_item(item_id)));

revoke execute on function
  public.create_item(jsonb, jsonb), public.save_item(uuid, integer, jsonb),
  public.delete_item(uuid), public.save_device_backup(jsonb),
  public.sync_pull(timestamptz), public.my_usage()
  from anon;
grant execute on function
  public.create_item(jsonb, jsonb), public.save_item(uuid, integer, jsonb),
  public.delete_item(uuid), public.save_device_backup(jsonb),
  public.sync_pull(timestamptz), public.my_usage()
  to authenticated;
