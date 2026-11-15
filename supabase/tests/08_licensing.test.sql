begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000008a1', 'lic-a@test.local'),
  ('00000000-0000-0000-0000-0000000008b2', 'lic-b@test.local');

set local role service_role;
select is((public.license_state('00000000-0000-0000-0000-0000000008a1', repeat('a', 64)) ->> 'entitled')::boolean,
          false, 'the free stage is not a license');

reset role;
insert into public.purchases (user_id, plan_key, type, status)
values ('00000000-0000-0000-0000-0000000008a1', 'builder_lifetime', 'comp', 'active');
set local role service_role;
select is(public.license_state('00000000-0000-0000-0000-0000000008a1', repeat('a', 64)) - 'expires_at',
          '{"device_active": false, "entitled": true, "lifetime": false, "grant": true}'::jsonb,
          'a grant entitles');

select ok(public.license_register_device('00000000-0000-0000-0000-0000000008a1', repeat(c, 64), null,
            '{"platform": "web", "label": "x"}'), 'device ' || c || ' registers')
  from unnest(array['1', '2', '3']) as c;
select is(public.license_register_device('00000000-0000-0000-0000-0000000008a1', repeat('4', 64), null,
            '{"platform": "linux"}'), false, 'a fourth device is refused');
select ok(public.license_register_device('00000000-0000-0000-0000-0000000008a1', repeat('1', 64), repeat('f', 64),
            '{"platform": "web"}'), 'an active device re-registers');
select is((public.license_state('00000000-0000-0000-0000-0000000008a1', repeat('1', 64)) ->> 'device_active')::boolean,
          true, 'the device is active');

-- As the user.
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000008a1", "role": "authenticated"}', true);
select throws_ok($$ select public.license_state('00000000-0000-0000-0000-0000000008a1', 'x') $$,
  '42501', null, 'clients cannot read license state');
select lives_ok(format($$ select public.deactivate_device(%L) $$,
  (select id from public.licensed_devices where device_pub_hash = repeat('2', 64))), 'a user frees a slot');
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000008b2", "role": "authenticated"}', true);
select is((select count(*)::int from public.licensed_devices), 0, 'others'' devices are invisible');

reset role;
set local role service_role;
select is(public.license_register_device('00000000-0000-0000-0000-0000000008a1', repeat('4', 64), null,
            '{"platform": "linux"}'), true, 'the freed slot takes a new device');

reset role;
select is((select count(*)::int from private.audit_log
            where kind = 'license_activated' and user_id = '00000000-0000-0000-0000-0000000008a1'),
          (select count(*)::int from public.licensed_devices
            where user_id = '00000000-0000-0000-0000-0000000008a1'),
          'every activated device is audit-logged');
select ok(exists (select 1 from private.audit_log
                   where kind = 'license_refused' and user_id = '00000000-0000-0000-0000-0000000008a1'),
          'a refused activation is audit-logged');

select * from finish();
rollback;
