begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

insert into auth.users (id, email, raw_app_meta_data) values
  ('00000000-0000-0000-0000-0000000011a1', 'staff@test.local', '{}'),
  ('00000000-0000-0000-0000-0000000011b2', 'admin@test.local', '{"role": "admin"}'),
  ('00000000-0000-0000-0000-0000000011c3', 'banned@test.local', '{}');

-- Charging has started: the free plan no longer grants the builder.
update public.plans set limits = jsonb_set(limits, '{builder}', '0') where key = 'free';

-- A free grant on the staff plan, and a paid lifetime for the banned user.
insert into public.purchases (user_id, plan_key, type, status) values
  ('00000000-0000-0000-0000-0000000011a1', 'staff', 'comp', 'active');
insert into public.purchases (user_id, plan_key, type, status, stripe_checkout_session_id) values
  ('00000000-0000-0000-0000-0000000011c3', 'builder_lifetime', 'one_time', 'active', 'cs_test_11');

set local role service_role;
select is(public.license_state('00000000-0000-0000-0000-0000000011a1', repeat('a', 64)) - 'expires_at',
          '{"device_active": false, "entitled": true, "lifetime": false, "grant": true}'::jsonb,
          'a staff grant licenses like a permanent grant');
select ok(public.license_register_device('00000000-0000-0000-0000-0000000011a1', repeat(c, 64), null,
            '{"platform": "linux"}'), 'staff device ' || c || ' registers')
  from unnest(array['1', '2', '3', '4']) as c;
select is((public.license_state('00000000-0000-0000-0000-0000000011b2', repeat('a', 64)) ->> 'entitled')::boolean,
          false, 'the admin role alone grants nothing');
select is((public.license_state('00000000-0000-0000-0000-0000000011c3', repeat('a', 64)) ->> 'entitled')::boolean,
          true, 'a paid lifetime is entitled');
reset role;

update auth.users set banned_until = now() + interval '100 years'
 where id = '00000000-0000-0000-0000-0000000011c3';
set local role service_role;
select is((public.license_state('00000000-0000-0000-0000-0000000011c3', repeat('a', 64)) ->> 'entitled')::boolean,
          false, 'a banned account is not entitled, even with a purchase');
reset role;

update auth.users set banned_until = now() - interval '1 day'
 where id = '00000000-0000-0000-0000-0000000011c3';
set local role service_role;
select is((public.license_state('00000000-0000-0000-0000-0000000011c3', repeat('a', 64)) ->> 'entitled')::boolean,
          true, 'an expired ban no longer counts');
reset role;

select * from finish();
rollback;
