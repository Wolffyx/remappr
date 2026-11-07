begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

insert into auth.users (id, email)
values ('00000000-0000-0000-0000-0000000015a1', 'stripe-a@test.local');

-- Subscriptions: inserted, then updated in place by later states.
select public.billing_upsert('{"type": "subscription", "user_id": "00000000-0000-0000-0000-0000000015a1",
  "plan_key": "builder_monthly", "status": "active", "valid_until": "2099-01-08T00:00:00Z",
  "stripe_subscription_id": "sub_1", "amount_cents": 500, "currency": "eur"}');
select is((select status || ':' || amount_cents || ':' || currency from public.purchases
            where stripe_subscription_id = 'sub_1'), 'active:500:eur', 'a subscription is recorded');
select is(private.plan_limit('00000000-0000-0000-0000-0000000015a1', 'max_devices'), 3,
  'an active subscription raises the limits');

select public.billing_upsert('{"type": "subscription", "user_id": null,
  "plan_key": "builder_yearly", "status": "ended", "valid_until": "2000-01-01T00:00:00Z",
  "stripe_subscription_id": "sub_1"}');
select is((select plan_key || ':' || status || ':' || amount_cents from public.purchases
            where stripe_subscription_id = 'sub_1'), 'builder_yearly:ended:500',
  'a later state updates plan and status and keeps the amount');
select is((select user_id::text from public.purchases where stripe_subscription_id = 'sub_1'),
  '00000000-0000-0000-0000-0000000015a1', 'an update without a user keeps the owner');
select is((select count(*)::int from public.purchases where stripe_subscription_id = 'sub_1'), 1,
  'replays never duplicate a subscription');

-- One-time: a refund sticks even when the paid session is written again.
select public.billing_upsert('{"type": "one_time", "user_id": "00000000-0000-0000-0000-0000000015a1",
  "plan_key": "builder_lifetime", "status": "active", "stripe_checkout_session_id": "cs_1",
  "stripe_payment_intent_id": "pi_1", "amount_cents": 4900, "currency": "eur"}');
select is((select status from public.purchases where stripe_checkout_session_id = 'cs_1'), 'active',
  'a paid lifetime purchase is active');
select public.billing_upsert('{"type": "payment", "stripe_payment_intent_id": "pi_1", "status": "refunded"}');
select is((select status from public.purchases where stripe_checkout_session_id = 'cs_1'), 'refunded',
  'a full refund ends it');
select public.billing_upsert('{"type": "one_time", "user_id": "00000000-0000-0000-0000-0000000015a1",
  "plan_key": "builder_lifetime", "status": "active", "stripe_checkout_session_id": "cs_1"}');
select is((select status from public.purchases where stripe_checkout_session_id = 'cs_1'), 'refunded',
  'replaying the paid session does not undo the refund');
select is((select stripe_payment_intent_id from public.purchases where stripe_checkout_session_id = 'cs_1'),
  'pi_1', 'a replay without the payment keeps it');

-- A dispute the seller wins restores the purchase.
select public.billing_upsert('{"type": "payment", "stripe_payment_intent_id": "pi_1", "status": "active"}');
select is((select status from public.purchases where stripe_checkout_session_id = 'cs_1'), 'active',
  'a payment row sets the status back');

select throws_ok($$ select public.billing_upsert('{"type": "gift"}') $$, '22023', null,
  'an unknown row is refused');

set local role authenticated;
select throws_ok($$ select public.billing_upsert('{"type": "payment", "stripe_payment_intent_id": "pi_1",
  "status": "active"}') $$, '42501', null, 'only the service role writes purchases');

select * from finish();
rollback;
