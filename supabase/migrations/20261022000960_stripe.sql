-- P6: Stripe. Checkout, the Billing Portal and the webhook (Edge Functions)
-- write purchases through billing_upsert; a nightly job replays recent Stripe
-- events in case a webhook was missed. Card and billing details stay in Stripe.

-- What the Upgrade dialog shows. Set with stripe_price_id per environment
-- (scripts/stripe-plans.ts prints the update); Stripe charges the price's own
-- amount, this is only its label.
alter table public.plans
  add column amount_cents integer check (amount_cents >= 0),
  add column currency     text    check (currency ~ '^[a-z]{3}$');

-- Webhook / reconcile writer (service role only). The Edge Function re-fetches
-- the Stripe object first, so writing its current state is idempotent and
-- order-safe. p_row.type:
--   subscription: {user_id, plan_key, status, valid_until, stripe_subscription_id,
--                  amount_cents?, currency?}
--   one_time:     {user_id, plan_key, status, stripe_checkout_session_id,
--                  stripe_payment_intent_id?, amount_cents?, currency?}
--   payment:      {stripe_payment_intent_id, status}  (refund, dispute and its outcome)
-- A refunded or disputed one-time purchase stays so when its (still "paid")
-- checkout session is written again; only a payment row changes it back.
create or replace function public.billing_upsert(p_row jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_type text := p_row ->> 'type';
begin
  if v_type = 'payment' then
    update public.purchases
       set status = p_row ->> 'status', updated_at = now()
     where stripe_payment_intent_id = p_row ->> 'stripe_payment_intent_id';
    return;
  end if;

  if v_type = 'subscription' then
    insert into public.purchases as u (user_id, plan_key, type, status, valid_until,
                                       stripe_subscription_id, amount_cents, currency)
    values ((p_row ->> 'user_id')::uuid, p_row ->> 'plan_key', 'subscription', p_row ->> 'status',
            (p_row ->> 'valid_until')::timestamptz, p_row ->> 'stripe_subscription_id',
            (p_row ->> 'amount_cents')::integer, p_row ->> 'currency')
    on conflict (stripe_subscription_id) do update
      set user_id      = coalesce(u.user_id, excluded.user_id),
          plan_key     = excluded.plan_key,
          status       = excluded.status,
          valid_until  = excluded.valid_until,
          amount_cents = coalesce(excluded.amount_cents, u.amount_cents),
          currency     = coalesce(excluded.currency, u.currency),
          updated_at   = now();
    return;
  end if;

  if v_type <> 'one_time' then
    raise exception 'unknown_billing_row' using errcode = '22023';
  end if;
  insert into public.purchases as u (user_id, plan_key, type, status, stripe_checkout_session_id,
                                     stripe_payment_intent_id, amount_cents, currency)
  values ((p_row ->> 'user_id')::uuid, p_row ->> 'plan_key', 'one_time', p_row ->> 'status',
          p_row ->> 'stripe_checkout_session_id', p_row ->> 'stripe_payment_intent_id',
          (p_row ->> 'amount_cents')::integer, p_row ->> 'currency')
  on conflict (stripe_checkout_session_id) do update
    set status = case when u.status in ('refunded', 'disputed') then u.status
                      else excluded.status end,
        stripe_payment_intent_id = coalesce(excluded.stripe_payment_intent_id, u.stripe_payment_intent_id),
        amount_cents = coalesce(excluded.amount_cents, u.amount_cents),
        currency     = coalesce(excluded.currency, u.currency),
        updated_at   = now();
end;
$$;
revoke execute on function public.billing_upsert(jsonb) from public, anon, authenticated;
grant execute on function public.billing_upsert(jsonb) to service_role;

-- Nightly reconcile: the billing-reconcile function replays the last days of
-- Stripe events. Its URL and secret live in Vault (never in git); until they
-- are set the job does nothing.
--   select vault.create_secret('https://<ref>.supabase.co/functions/v1/billing-reconcile', 'billing_reconcile_url');
--   select vault.create_secret('<BILLING_RECONCILE_SECRET>', 'billing_reconcile_secret');
create extension if not exists pg_net;   -- if the migration role lacks rights: enable in Dashboard → Integrations
select cron.schedule('billing-reconcile', '41 2 * * *', $job$
  select net.http_post(
           url     := (select decrypted_secret from vault.decrypted_secrets
                        where name = 'billing_reconcile_url'),
           headers := jsonb_build_object(
                        'Content-Type', 'application/json',
                        'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets
                                           where name = 'billing_reconcile_secret')),
           body    := '{}'::jsonb)
   where exists (select 1 from vault.decrypted_secrets where name = 'billing_reconcile_url')
$job$);
