-- Foundation: extensions, the unexposed `private` schema, default-privilege
-- lockdown, `lookups`, rate limits and the audit log.

-- Extensions live in `extensions` on Supabase.
create extension if not exists citext   with schema extensions;
create extension if not exists pg_trgm  with schema extensions;
create extension if not exists pgcrypto with schema extensions;

-- New functions are NOT executable by PUBLIC unless granted explicitly.
-- (Per-schema revokes can't remove the global PUBLIC default, so do it globally.)
-- Runs AFTER the extensions above on purpose: their functions (pg_trgm `%`,
-- citext ops, pgcrypto) keep PUBLIC execute. Extensions added later need explicit grants.
alter default privileges for role postgres revoke execute on functions from public;

-- `private`: helpers + internal tables, never exposed through the Data API.
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to anon, authenticated, service_role;

-- ── lookups: small admin-owned reference lists ──────────────────────────────
create table public.lookups (
  category text not null check (category in ('device_kind', 'device_form', 'document_kind',
                                             'identifier_scheme', 'generic_usb', 'reserved_username')),
  key      text not null check (char_length(key) between 1 and 128),
  data     jsonb not null default '{}'::jsonb check (jsonb_typeof(data) = 'object'),
  primary key (category, key)
);
alter table public.lookups enable row level security;
revoke all on public.lookups from anon, authenticated;
grant select on public.lookups to anon, authenticated;
create policy lookups_read on public.lookups for select to anon, authenticated using (true);

create function private.lookup(p_category text, p_key text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select l.data from public.lookups l where l.category = p_category and l.key = p_key;
$$;

insert into public.lookups (category, key)
select 'reserved_username', t.u
  from unnest(array['admin', 'administrator', 'remappr', 'support', 'help', 'moderator', 'mod',
                    'staff', 'official', 'system', 'root', 'api', 'deleted']) as t (u);

-- Admin = service-role-set app_metadata.role AND an MFA (aal2) session.
create function private.is_admin() returns boolean
language sql stable set search_path = '' as $$
  select coalesce((select auth.jwt()) -> 'app_metadata' ->> 'role', '') = 'admin'
     and coalesce((select auth.jwt()) ->> 'aal', '') = 'aal2';
$$;
grant execute on function private.is_admin() to authenticated;

-- ── rate limits (also used for per-day dedupe) ───────────────────────────────
create table private.rate_limits (
  user_id      uuid not null,
  action       text not null,
  window_start timestamptz not null,
  hits         integer not null default 0,
  primary key (user_id, action, window_start)
);

-- Fixed-window limiter; raises `rate_limited` (hint = action) past p_max.
create function private.hit_rate_limit(p_action text, p_max integer, p_window interval)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_uid  uuid := (select auth.uid());
  v_hits integer;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  insert into private.rate_limits as r (user_id, action, window_start, hits)
  values (v_uid, p_action, date_bin(p_window, now(), timestamptz '2000-01-01'), 1)
  on conflict (user_id, action, window_start) do update set hits = r.hits + 1
  returning r.hits into v_hits;
  if v_hits > p_max then
    raise exception 'rate_limited' using errcode = 'P0001', hint = p_action;
  end if;
end;
$$;

-- True only for the caller's first hit of p_action in the window (dedupe).
create function private.first_in_window(p_action text, p_window interval)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null then
    return false;
  end if;
  insert into private.rate_limits (user_id, action, window_start, hits)
  values ((select auth.uid()), p_action, date_bin(p_window, now(), timestamptz '2000-01-01'), 1)
  on conflict (user_id, action, window_start) do nothing;
  return found;
end;
$$;

-- ── audit log ────────────────────────────────────────────────────────────────
create table private.audit_log (
  id      bigint generated always as identity primary key,
  kind    text not null,      -- package_download | moderation | device_deactivated | admin_grant …
  user_id uuid,
  subject uuid,               -- item / comment / activation id
  data    jsonb not null default '{}'::jsonb,
  at      timestamptz not null default now()
);
create index audit_log_kind_at   on private.audit_log (kind, at desc);
create index audit_log_watermark on private.audit_log ((data ->> 'watermark')) where kind = 'package_download';

create function private.audit(p_kind text, p_subject uuid, p_data jsonb) returns void
language sql security definer set search_path = '' as $$
  insert into private.audit_log (kind, user_id, subject, data)
  values (p_kind, (select auth.uid()), p_subject, coalesce(p_data, '{}'::jsonb));
$$;
