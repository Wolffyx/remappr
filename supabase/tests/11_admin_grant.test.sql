begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

insert into auth.users (id, email, raw_app_meta_data) values
  ('00000000-0000-0000-0000-0000000011a1', 'admin@test.local', '{"role": "admin"}'),
  ('00000000-0000-0000-0000-0000000011b2', 'user@test.local', '{}');

-- Charging has started: the free plan no longer grants the builder.
update public.plans set limits = jsonb_set(limits, '{builder}', '0') where key = 'free';

set local role service_role;
select is(public.license_state('00000000-0000-0000-0000-0000000011a1', repeat('a', 64)) - 'expires_at',
          '{"device_active": false, "entitled": true, "lifetime": false, "grant": true}'::jsonb,
          'an admin holds a permanent grant without a purchase');
select is((public.license_state('00000000-0000-0000-0000-0000000011b2', repeat('a', 64)) ->> 'entitled')::boolean,
          false, 'anyone else still needs to pay');
select ok(public.license_register_device('00000000-0000-0000-0000-0000000011a1', repeat(c, 64), null,
            '{"platform": "linux"}'), 'admin device ' || c || ' registers')
  from unnest(array['1', '2', '3', '4']) as c;
select is(public.license_register_device('00000000-0000-0000-0000-0000000011b2', repeat('1', 64), null,
            '{"platform": "linux"}'), false, 'a non-admin gets no device slot');
reset role;

select is(private.plan_limit('00000000-0000-0000-0000-0000000011a1', 'max_devices'), 10,
          'admins get the staff device limit');

select * from finish();
rollback;
