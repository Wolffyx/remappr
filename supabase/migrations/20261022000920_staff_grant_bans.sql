-- Free builder access goes through the normal purchase system: a "comp" row
-- on the staff plan (builder, the paid plans' limits, 10 devices), granted by
-- hand to the team or anyone else (docs/dev/operations.md). It licenses like
-- a permanent grant: offline for good, revoked by ending the row. The admin
-- role stays about moderation and grants nothing.
--
-- A banned account (auth.users.banned_until in the future, the dashboard's
-- "Ban user") is not entitled to the builder, whatever it bought or was
-- granted: activation fails, renewals come back revoked, and get-package
-- refuses it.

insert into public.plans (key, name, billing, billing_interval, is_active, limits)
select 'staff', 'Remappr staff', 'comp', null, false,
       p.limits || '{"max_devices": 10}'::jsonb
  from public.plans p where p.key = 'builder_lifetime';

create function private.user_is_banned(p_user uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select u.banned_until > now() from auth.users u where u.id = p_user), false);
$$;

-- What a license may claim right now; a banned account holds nothing.
create or replace function public.license_state(p_user uuid, p_device text) returns jsonb
language sql stable security definer set search_path = '' as $$
  with sources as (
    select u.valid_until, u.type
      from public.purchases u
      join public.plans p on p.key = u.plan_key
     where u.user_id = p_user and u.status = 'active'
       and (u.valid_until is null or u.valid_until > now())
       and coalesce((p.limits ->> 'builder')::integer, 0) > 0
       and not private.user_is_banned(p_user)
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
