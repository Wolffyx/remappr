begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

insert into auth.users (id, email)
values
  ('00000000-0000-0000-0000-0000000003a1', 'billing-a@test.local'),
  ('00000000-0000-0000-0000-0000000003b2', 'billing-b@test.local');

-- Alice bought the lifetime builder; Bob's subscription lapsed.
insert into public.purchases (user_id, plan_key, type, status, stripe_checkout_session_id)
values ('00000000-0000-0000-0000-0000000003a1', 'builder_lifetime', 'one_time', 'active', 'cs_test_a');
insert into public.purchases (user_id, plan_key, type, status, valid_until, stripe_subscription_id)
values ('00000000-0000-0000-0000-0000000003b2', 'builder_monthly', 'subscription', 'active',
        now() - interval '1 day', 'sub_test_b');

select is(private.plan_limit('00000000-0000-0000-0000-0000000003a1', 'cloud_private_items'),
          200, 'an active purchase raises the limit');
select is(private.plan_limit('00000000-0000-0000-0000-0000000003b2', 'cloud_private_items'),
          10, 'an expired subscription falls back to the free plan');
select is(private.plan_limit('00000000-0000-0000-0000-0000000003b2', 'no_such_key'),
          0, 'an unknown limit is 0');

-- As anon.
set local role anon;
select is((public.my_plan() -> 'limits' ->> 'builder')::int, 1,
          'anon gets the free plan limits (builder free for now)');
select is(public.my_plan() -> 'purchases', '[]'::jsonb, 'anon has no purchases');
select is((select count(*)::int from public.plans where key = 'free'), 1, 'anon reads plans');
select throws_ok($$ select public.billing_upsert('{}') $$, '42501', null,
                 'anon cannot write billing');

-- As Alice.
reset role;
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub": "00000000-0000-0000-0000-0000000003a1", "role": "authenticated"}', true);
select is((public.my_plan() -> 'limits' ->> 'max_devices')::int, 3, 'my_plan merges purchases');
select is(jsonb_array_length(public.my_plan() -> 'purchases'), 1, 'my_plan lists own purchases');
select is((select count(*)::int from public.purchases
             where user_id = '00000000-0000-0000-0000-0000000003b2'),
          0, 'another user''s purchases are hidden');
select throws_ok(
  $$ insert into public.purchases (user_id, plan_key, type, status)
     values ('00000000-0000-0000-0000-0000000003a1', 'builder_lifetime', 'comp', 'active') $$,
  '42501', null, 'clients cannot grant themselves a purchase');

-- The webhook writer: a subscription update is idempotent on its Stripe id.
reset role;
select public.billing_upsert(jsonb_build_object(
  'type', 'subscription', 'user_id', '00000000-0000-0000-0000-0000000003b2',
  'plan_key', 'builder_yearly', 'status', 'active',
  'valid_until', now() + interval '1 year', 'stripe_subscription_id', 'sub_test_b'));
select is(private.plan_limit('00000000-0000-0000-0000-0000000003b2', 'builder'), 1,
          'billing_upsert renews a subscription in place');

select * from finish();
rollback;
