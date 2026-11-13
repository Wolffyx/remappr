-- Every builder activation is audit-logged (a new device, or one reactivated),
-- so a shared account or a leaked key shows up in the weekly report
-- (docs/dev/operations.md). Refreshes are not logged: licensed_devices.
-- last_seen_at already records them.

create or replace function public.license_register_device(p_user uuid, p_device text, p_machine text, p_meta jsonb)
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
    insert into private.audit_log (kind, user_id, data)
    values ('license_refused', p_user, jsonb_build_object('device', p_device, 'reason', 'device_limit'));
    return false;
  end if;
  insert into public.licensed_devices (user_id, device_pub_hash, machine_hash, platform, label)
  values (p_user, p_device, p_machine, p_meta ->> 'platform', left(coalesce(p_meta ->> 'label', ''), 80))
  on conflict (user_id, device_pub_hash) do update
    set revoked_at = null, last_seen_at = now(), machine_hash = excluded.machine_hash,
        platform = excluded.platform, label = excluded.label;
  insert into private.audit_log (kind, user_id, data)
  values ('license_activated', p_user,
          jsonb_build_object('device', p_device, 'machine', p_machine,
                             'platform', p_meta ->> 'platform'));
  return true;
end;
$$;
