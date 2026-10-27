-- Social (plan P5): stars, comments (one reply level), reports (three open
-- reports flag an item into the moderation queue) and admin moderation; plus
-- collection_members, which resolves a collection's document under RLS so
-- private or deleted members drop out. Admin RPCs need an aal2 (MFA) session.

create table public.item_stars (
  user_id    uuid not null default auth.uid() references public.users (id) on delete cascade,
  item_id    uuid not null references public.library_items (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, item_id)
);

create table public.item_comments (
  id         uuid primary key default gen_random_uuid(),
  item_id    uuid not null references public.library_items (id) on delete cascade,
  author_id  uuid default auth.uid() references public.users (id) on delete set null, -- "[deleted]"
  parent_id  uuid references public.item_comments (id) on delete cascade,
  body       text not null,
  moderation text not null default 'ok' check (moderation in ('ok', 'hidden')),
  created_at timestamptz not null default now(),
  edited_at  timestamptz,
  deleted_at timestamptz,
  check (deleted_at is not null or char_length(body) between 1 and 4000)
);
create index comments_item on public.item_comments (item_id, created_at);

create table public.content_reports (
  id          uuid primary key default gen_random_uuid(),
  reporter_id uuid not null default auth.uid() references public.users (id) on delete cascade,
  item_id     uuid references public.library_items (id) on delete cascade,
  comment_id  uuid references public.item_comments (id) on delete cascade,
  reason      text not null check (reason in ('spam', 'malicious_macro', 'broken',
                                              'inappropriate', 'copyright', 'other')),
  note        text not null default '' check (char_length(note) <= 1000),
  status      text not null default 'open' check (status in ('open', 'actioned', 'dismissed')),
  created_at  timestamptz not null default now(),
  resolved_at timestamptz,
  check (num_nonnulls(item_id, comment_id) = 1)
);
create unique index reports_once_item    on public.content_reports (reporter_id, item_id)    where item_id is not null;
create unique index reports_once_comment on public.content_reports (reporter_id, comment_id) where comment_id is not null;
create index reports_open on public.content_reports (created_at) where status = 'open';

-- Counters live on items (the items trigger skips search/updated_at for these).
create function private.bump_count() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_table_name = 'item_stars' and tg_op = 'DELETE' then
    update public.library_items set stars_count = greatest(stars_count - 1, 0) where id = old.item_id;
    return null;
  end if;
  if tg_table_name = 'item_stars' then
    update public.library_items set stars_count = stars_count + 1 where id = new.item_id;
    return null;
  end if;
  update public.library_items set comments_count = comments_count + 1 where id = new.item_id;
  return null;
end;
$$;
create trigger stars_count after insert or delete on public.item_stars
  for each row execute function private.bump_count();
create trigger comments_count after insert on public.item_comments
  for each row execute function private.bump_count();

create function private.can_comment(p_item uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.library_items i
                  where i.id = p_item and i.visibility = 'public'
                    and i.moderation = 'ok' and i.deleted_at is null)
     and exists (select 1 from public.users p
                  where p.id = (select auth.uid()) and p.username is not null);
$$;
grant execute on function private.can_comment(uuid) to authenticated;

create function private.comments_before_write() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'UPDATE' then
    new.edited_at := now();
    return new;
  end if;
  perform private.hit_rate_limit('comment', 30, interval '1 hour');
  if new.parent_id is not null and not exists (
       select 1 from public.item_comments c
        where c.id = new.parent_id and c.item_id = new.item_id and c.parent_id is null) then
    raise exception 'invalid_parent' using errcode = '22023';
  end if;
  return new;
end;
$$;
create trigger comments_before_write before insert or update of body on public.item_comments
  for each row execute function private.comments_before_write();

-- 20 reports/day per user; 3 open reports auto-flag the item into the queue.
create function private.reports_after_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform private.hit_rate_limit('report', 20, interval '1 day');
  if new.item_id is not null
     and (select count(*) from public.content_reports r where r.item_id = new.item_id and r.status = 'open') >= 3 then
    update public.library_items set moderation = 'flagged' where id = new.item_id and moderation = 'ok';
  end if;
  return null;
end;
$$;
create trigger reports_after_insert after insert on public.content_reports
  for each row execute function private.reports_after_insert();

create function public.delete_comment(p_comment uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.item_comments set deleted_at = now(), body = ''
   where id = p_comment and author_id = (select auth.uid()) and deleted_at is null;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
end;
$$;

-- The item owner (on their own item) or an admin can hide a comment.
create function public.hide_comment(p_comment uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.item_comments c set moderation = 'hidden'
   where c.id = p_comment and (private.is_admin() or private.owns_item(c.item_id));
  if not found then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  perform private.audit('moderation', p_comment, jsonb_build_object('target', 'comment', 'status', 'hidden'));
end;
$$;

-- Admin: set an item's or comment's moderation and close its open reports.
create function public.moderate(p_target text, p_id uuid, p_status text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_target = 'item' then
    update public.library_items set moderation = p_status where id = p_id;
  else
    update public.item_comments set moderation = p_status where id = p_id;
  end if;
  update public.content_reports set status = 'actioned', resolved_at = now()
   where status = 'open' and (item_id = p_id or comment_id = p_id);
  perform private.audit('moderation', p_id, jsonb_build_object('target', p_target, 'status', p_status));
end;
$$;

alter table public.item_stars    enable row level security;
alter table public.item_comments enable row level security;
alter table public.content_reports  enable row level security;
revoke all on public.item_stars, public.item_comments, public.content_reports from anon, authenticated;

grant select, delete on public.item_stars to authenticated;
grant insert (item_id) on public.item_stars to authenticated;
create policy stars_read   on public.item_stars for select to authenticated using (user_id = (select auth.uid()));
create policy stars_insert on public.item_stars for insert to authenticated
  with check (user_id = (select auth.uid()) and private.can_read_item(item_id));
create policy stars_delete on public.item_stars for delete to authenticated using (user_id = (select auth.uid()));

grant select on public.item_comments to anon, authenticated;
grant insert (item_id, parent_id, body), update (body) on public.item_comments to authenticated;
create policy comments_read on public.item_comments for select to anon, authenticated
  using ((moderation = 'ok' and private.can_read_item(item_id)) or author_id = (select auth.uid()));
create policy comments_insert on public.item_comments for insert to authenticated
  with check (author_id = (select auth.uid()) and private.can_comment(item_id));
create policy comments_edit on public.item_comments for update to authenticated
  using (author_id = (select auth.uid()) and deleted_at is null)
  with check (author_id = (select auth.uid()));

grant select on public.content_reports to authenticated;
grant insert (item_id, comment_id, reason, note) on public.content_reports to authenticated;
create policy reports_insert on public.content_reports for insert to authenticated
  with check (reporter_id = (select auth.uid()));
create policy reports_read on public.content_reports for select to authenticated
  using (reporter_id = (select auth.uid()) or private.is_admin());

revoke execute on function public.delete_comment(uuid), public.hide_comment(uuid),
  public.moderate(text, uuid, text) from anon;
grant execute on function public.delete_comment(uuid), public.hide_comment(uuid),
  public.moderate(text, uuid, text) to authenticated;

-- Members of a collection the caller can see; unreadable/deleted members drop out (RLS).
create function public.collection_members(p_collection uuid)
returns table (item_id uuid, note text, ord bigint, name text, type text, owner_username text)
language sql stable security invoker set search_path = '' as $$
  select m.id, m.note, m.ord, i.name, i.type, p.username::text
    from public.library_items c
    join public.library_item_versions v
      on v.item_id = c.id
     and v.version = case when c.owner_id = (select auth.uid()) then c.head_version
                          else c.published_version end
    cross join lateral rows from (jsonb_to_recordset(v.document -> 'items') as (id uuid, note text))
         with ordinality as m (id, note, ord)
    join public.library_items i on i.id = m.id and i.deleted_at is null
    join public.users p on p.id = i.owner_id
   where c.id = p_collection and c.type = 'collection'
   order by m.ord;
$$;


-- Admin: the open reports, one row per reported item or comment, with what
-- the queue shows (the reported thing may be flagged, so plain RLS reads
-- would hide it).
create function public.moderation_queue()
returns table (target text, id uuid, item_id uuid, title text, body text, owner_username text,
               moderation text, reports bigint, reasons text[], notes text[], first_reported timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query
    select 'item'::text, i.id, i.id, i.name, i.summary, u.username::text, i.moderation,
           count(*), array_agg(distinct r.reason), array_remove(array_agg(nullif(r.note, '')), null),
           min(r.created_at)
      from public.content_reports r
      join public.library_items i on i.id = r.item_id
      left join public.users u on u.id = i.owner_id
     where r.status = 'open'
     group by i.id, u.username
    union all
    select 'comment'::text, c.id, c.item_id, i.name, c.body, u.username::text, c.moderation,
           count(*), array_agg(distinct r.reason), array_remove(array_agg(nullif(r.note, '')), null),
           min(r.created_at)
      from public.content_reports r
      join public.item_comments c on c.id = r.comment_id
      join public.library_items i on i.id = c.item_id
      left join public.users u on u.id = c.author_id
     where r.status = 'open'
     group by c.id, i.name, u.username
     order by 8 desc, 11;
end;
$$;

-- Admin: close an item's or comment's open reports without acting on it.
create function public.dismiss_reports(p_target text, p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.content_reports set status = 'dismissed', resolved_at = now()
   where status = 'open'
     and case p_target when 'item' then item_id = p_id else comment_id = p_id end;
  perform private.audit('moderation', p_id, jsonb_build_object('target', p_target, 'status', 'dismissed'));
end;
$$;

revoke execute on function public.moderation_queue(), public.dismiss_reports(text, uuid) from anon;
grant execute on function public.moderation_queue(), public.dismiss_reports(text, uuid) to authenticated;
grant execute on function public.collection_members(uuid) to anon, authenticated;
