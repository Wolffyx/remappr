-- P10f: an item's GitHub remote (plan §6c A2). The link lives on the device
-- too (it works with no account); this copy lets every signed-in device of
-- the owner know it. Owner-only: read by policy, written by the RPCs below.

create table public.item_git_links (
  item_id         uuid primary key references public.library_items (id) on delete cascade,
  provider        text not null default 'github' check (provider in ('github')),
  repo            text not null check (repo ~ '^[A-Za-z0-9_.-]{1,100}/[A-Za-z0-9_.-]{1,100}$'),
  branch          text not null default 'main'
                  check (char_length(branch) between 1 and 255 and branch !~ '(^/|/$|[.][.]|[[:space:]~^:?*\[\\])'),
  folder          text not null default 'remappr'
                  check (folder ~ '^[A-Za-z0-9_.-]+(/[A-Za-z0-9_.-]+)*$' and folder !~ '(^|/)[.][.]?(/|$)'
                         and char_length(folder) <= 200),
  -- The file name (<folder>/<slug>.remappr.json), fixed at link time.
  slug            text not null check (slug ~ '^[a-z0-9][a-z0-9-]{0,59}$'),
  -- The compiler target whose files are generated beside the source; null:
  -- the source only.
  target          text check (target ~ '^[a-z0-9-]{1,40}$'),
  auto_push       boolean not null default true,
  last_synced_sha text check (last_synced_sha ~ '^[0-9a-f]{40}$'),
  last_synced_at  timestamptz,
  updated_at      timestamptz not null default now()
);

-- p_link: {repo, slug, branch?, folder?, target?, auto_push?}, or null to
-- unlink. Changing the repo, branch, folder or slug forgets the synced commit.
create function public.set_git_link(p_item uuid, p_link jsonb) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.owns_item(p_item) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_link is null or jsonb_typeof(p_link) = 'null' then
    delete from public.item_git_links where item_id = p_item;
    return;
  end if;
  insert into public.item_git_links as g (item_id, repo, slug, branch, folder, target, auto_push)
  values (p_item, p_link ->> 'repo', p_link ->> 'slug', coalesce(p_link ->> 'branch', 'main'),
          coalesce(p_link ->> 'folder', 'remappr'), p_link ->> 'target',
          coalesce((p_link ->> 'auto_push')::boolean, true))
  on conflict (item_id) do update
    set repo = excluded.repo, slug = excluded.slug, branch = excluded.branch, folder = excluded.folder,
        target = excluded.target, auto_push = excluded.auto_push, updated_at = now(),
        last_synced_sha = case
          when (g.repo, g.branch, g.folder, g.slug) = (excluded.repo, excluded.branch, excluded.folder, excluded.slug)
          then g.last_synced_sha end,
        last_synced_at = case
          when (g.repo, g.branch, g.folder, g.slug) = (excluded.repo, excluded.branch, excluded.folder, excluded.slug)
          then g.last_synced_at end;
end;
$$;

-- After a push or pull: advance the link, and record the commit on the cloud
-- version it carries (p_version null: none, e.g. a local-only checkpoint).
create function public.mark_git_synced(p_item uuid, p_sha text, p_version integer default null)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.owns_item(p_item) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_sha !~ '^[0-9a-f]{40}$' then
    raise exception 'invalid_sha' using errcode = '22023';
  end if;
  if p_version is not null then
    update public.library_item_versions set git_commit_sha = p_sha
     where item_id = p_item and version = p_version;
  end if;
  update public.item_git_links set last_synced_sha = p_sha, last_synced_at = now()
   where item_id = p_item;
end;
$$;

alter table public.item_git_links enable row level security;
revoke all on public.item_git_links from anon, authenticated;
grant select on public.item_git_links to authenticated;
create policy git_links_own on public.item_git_links for select to authenticated
  using (private.owns_item(item_id));

revoke execute on function public.set_git_link(uuid, jsonb),
                           public.mark_git_synced(uuid, text, integer) from public, anon;
grant execute on function public.set_git_link(uuid, jsonb),
                          public.mark_git_synced(uuid, text, integer) to authenticated;
