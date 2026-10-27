-- Licensing (plan P8b): devices bound to a builder license (max per plan),
-- released builder package metadata, the private package bucket, and the
-- service-role functions license-activate / license-refresh / get-package use.

create table public.licensed_devices (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users (id) on delete cascade,
  device_pub_hash text not null check (device_pub_hash ~ '^[0-9a-f]{64}$'),   -- sha256(SPKI)
  machine_hash    text check (machine_hash ~ '^[0-9a-f]{64}$'),             -- Electron only
  platform        text not null check (platform in ('web', 'linux', 'windows', 'macos')),
  label           text not null default '' check (char_length(label) <= 80),
  activated_at    timestamptz not null default now(),
  last_seen_at    timestamptz not null default now(),
  revoked_at      timestamptz,
  unique (user_id, device_pub_hash)
);

-- Released builder package versions (metadata only; the files sit in the private bucket).
create table public.builder_packages (
  version        text primary key check (version ~ '^[0-9]+[.][0-9]+[.][0-9]+$'),
  host_api       text not null,                         -- semver range the host must satisfy, e.g. '^1'
  storage_prefix text not null,                         -- 'builder/1.4.0/' inside the private bucket
  files          jsonb not null check (jsonb_typeof(files) = 'array'),   -- [{path, sha256, bytes}]
  channel        text not null default 'stable' check (channel in ('stable', 'beta')),
  changelog      text not null default '' check (char_length(changelog) <= 20000),   -- release-please notes
  published_at   timestamptz not null default now()
);

-- Package files: private bucket, no policies → service role only (CI upload, get-package).
insert into storage.buckets (id, name, public) values ('packages', 'packages', false);

-- What a license may claim right now (license-activate / license-refresh, service role).
create or replace function public.license_state(p_user uuid, p_device text) returns jsonb
language sql stable security definer set search_path = '' as $$
  with sources as (
    select u.valid_until, u.type
      from public.purchases u
      join public.plans p on p.key = u.plan_key
     where u.user_id = p_user and u.status = 'active'
       and (u.valid_until is null or u.valid_until > now())
       and coalesce((p.limits ->> 'builder')::integer, 0) > 0
  )
  select jsonb_build_object(
    'device_active', exists (select 1 from public.licensed_devices a
                              where a.user_id = p_user and a.device_pub_hash = p_device
                                and a.revoked_at is null),
    'entitled',   exists (select 1 from sources),
    'lifetime',   exists (select 1 from sources s where s.valid_until is null and s.type <> 'comp'),
    'grant',      exists (select 1 from sources s where s.type = 'comp'),
    'expires_at', (select max(s.valid_until) from sources s));
$$;

-- Register or touch a device. Returns false when max_devices is reached. p_meta: {platform, label}
create function public.license_register_device(p_user uuid, p_device text, p_machine text, p_meta jsonb)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  v_active integer;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user::text, 2));
  update public.licensed_devices
     set last_seen_at = now(), machine_hash = coalesce(p_machine, machine_hash)
   where user_id = p_user and device_pub_hash = p_device and revoked_at is null;
  if found then
    return true;
  end if;
  select count(*) into v_active from public.licensed_devices
   where user_id = p_user and revoked_at is null;
  if v_active >= private.plan_limit(p_user, 'max_devices') then
    return false;
  end if;
  insert into public.licensed_devices (user_id, device_pub_hash, machine_hash, platform, label)
  values (p_user, p_device, p_machine, p_meta ->> 'platform', left(coalesce(p_meta ->> 'label', ''), 80))
  on conflict (user_id, device_pub_hash) do update
    set revoked_at = null, last_seen_at = now(), machine_hash = excluded.machine_hash,
        platform = excluded.platform, label = excluded.label;
  return true;
end;
$$;

-- get-package logs every delivery (leak tracing). p_entry: {user_id, device_pub_hash, version, watermark}
create function public.log_package_download(p_entry jsonb) returns void
language sql security definer set search_path = '' as $$
  insert into private.audit_log (kind, user_id, data)
  values ('package_download', (p_entry ->> 'user_id')::uuid, p_entry - 'user_id');
$$;

-- User frees a slot (5 per 30 days, so slots can't be cycled).
create function public.deactivate_device(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.hit_rate_limit('deactivate_device', 5, interval '30 days');
  update public.licensed_devices set revoked_at = now()
   where id = p_id and user_id = (select auth.uid()) and revoked_at is null;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  perform private.audit('device_deactivated', p_id, '{}'::jsonb);
end;
$$;

alter table public.licensed_devices enable row level security;
alter table public.builder_packages enable row level security;
revoke all on public.licensed_devices, public.builder_packages from anon, authenticated;
grant select on public.licensed_devices to authenticated;
grant select on public.builder_packages to anon, authenticated;
create policy builder_packages_read on public.builder_packages for select to anon, authenticated using (true);
create policy activations_own on public.licensed_devices for select to authenticated
  using (user_id = (select auth.uid()));

revoke execute on function public.license_state(uuid, text),
  public.license_register_device(uuid, text, text, jsonb),
  public.log_package_download(jsonb) from anon, authenticated;
grant execute on function public.license_state(uuid, text),
  public.license_register_device(uuid, text, text, jsonb),
  public.log_package_download(jsonb) to service_role;
revoke execute on function public.deactivate_device(uuid) from anon;
grant execute on function public.deactivate_device(uuid) to authenticated;
