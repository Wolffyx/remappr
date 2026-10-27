-- Admins get the builder without paying: an account whose app_metadata role
-- is "admin" counts as holding a permanent comp grant of the "staff" plan
-- (builder, the paid plans' limits, 10 devices). No purchase row is needed,
-- and nothing changes for anyone else. app_metadata is set only by the
-- service role or the dashboard, so users cannot give themselves the role:
--   update auth.users set raw_app_meta_data = raw_app_meta_data || '{"role": "admin"}'
--    where email = '…';

insert into public.plans (key, name, billing, billing_interval, is_active, limits)
select 'staff', 'Remappr staff', 'comp', null, false,
       p.limits || '{"max_devices": 10}'::jsonb
  from public.plans p where p.key = 'builder_lifetime';

create function private.user_is_admin(p_user uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select u.raw_app_meta_data ->> 'role' = 'admin'
                     from auth.users u where u.id = p_user), false);
$$;

-- A user's effective limit: max(free plan, every active purchase's plan, and
-- the staff plan for admins).
create or replace function private.plan_limit(p_user uuid, p_key text) returns integer
language sql stable security definer set search_path = '' as $$
  select greatest(
    coalesce((select (p.limits ->> p_key)::integer from public.plans p where p.key = 'free'), 0),
    coalesce((select max((p.limits ->> p_key)::integer)
                from public.purchases u
                join public.plans p on p.key = u.plan_key
               where u.user_id = p_user and u.status = 'active'
                 and (u.valid_until is null or u.valid_until > now())), 0),
    case when private.user_is_admin(p_user)
         then coalesce((select (p.limits ->> p_key)::integer from public.plans p where p.key = 'staff'), 0)
         else 0 end);
$$;

-- What a license may claim right now; an admin holds a permanent grant.
create or replace function public.license_state(p_user uuid, p_device text) returns jsonb
language sql stable security definer set search_path = '' as $$
  with sources as (
    select u.valid_until, u.type
      from public.purchases u
      join public.plans p on p.key = u.plan_key
     where u.user_id = p_user and u.status = 'active'
       and (u.valid_until is null or u.valid_until > now())
       and coalesce((p.limits ->> 'builder')::integer, 0) > 0
    union all
    select null::timestamptz, 'comp'
      from public.plans p
     where p.key = 'staff' and private.user_is_admin(p_user)
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
