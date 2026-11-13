-- Billing: plans with their limits, what each user has bought, and the gate
-- the client and later RPCs read (plan_limit / plan_allows / my_plan).
-- No Stripe yet: billing_upsert is the writer the webhook will call.

-- Plans: the free plan + every paid / comp plan, each with its limits.
-- Change a number = one UPDATE (no release). Paid plans are switched on per environment.
create table public.plans (
  key              text primary key check (key ~ '^[a-z][a-z0-9_]{1,40}$'),
  name             text not null,
  billing          text not null check (billing in ('free', 'one_time', 'subscription', 'comp')),
  billing_interval text check (billing_interval in ('month', 'year')),
  stripe_price_id  text unique,                      -- set per environment; null for free / comp
  is_active        boolean not null default false,   -- offered in the Upgrade dialog
  limits           jsonb not null check (jsonb_typeof(limits) = 'object'),
  check ((billing = 'subscription') = (billing_interval is not null))
);

-- What a user has: a one-time payment, a subscription, or a comp (free grant).
-- Active rows apply their plan's limits.
-- NO card, bank or billing-address data is ever stored: Stripe Checkout collects
-- and keeps it. Only Stripe reference ids, plan, status and amounts live here.
create table public.purchases (
  id                         uuid primary key default gen_random_uuid(),
  user_id                    uuid references auth.users (id) on delete set null,   -- kept for tax records
  plan_key                   text not null references public.plans (key),
  type                       text not null check (type in ('one_time', 'subscription', 'comp')),
  status                     text not null check (status in ('pending', 'active', 'ended',
                                                             'refunded', 'disputed', 'failed')),
  valid_until                timestamptz,              -- null = forever; subscription: period_end + 7 d
  stripe_checkout_session_id text unique,
  stripe_subscription_id     text unique,
  stripe_payment_intent_id   text unique,
  amount_cents               integer check (amount_cents >= 0),
  currency                   text check (currency ~ '^[a-z]{3}$'),
  note                       text not null default '' check (char_length(note) <= 500),
  created_at                 timestamptz not null default now(),
  updated_at                 timestamptz not null default now(),
  check (type = 'comp' or num_nonnulls(stripe_checkout_session_id, stripe_subscription_id) > 0)
);
create index purchases_active_user on public.purchases (user_id) where status = 'active';

-- A user's effective limit: max(free plan, every active purchase's plan).
create function private.plan_limit(p_user uuid, p_key text) returns integer
language sql stable security definer set search_path = '' as $$
  select greatest(
    coalesce((select (p.limits ->> p_key)::integer from public.plans p where p.key = 'free'), 0),
    coalesce((select max((p.limits ->> p_key)::integer)
                from public.purchases u
                join public.plans p on p.key = u.plan_key
               where u.user_id = p_user and u.status = 'active'
                 and (u.valid_until is null or u.valid_until > now())), 0));
$$;

create function private.plan_allows(p_key text) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.plan_limit((select auth.uid()), p_key) > 0;
$$;

-- Client: effective limits + active purchases (anon → free plan limits).
create function public.my_plan() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'limits', (select jsonb_object_agg(k.key, private.plan_limit((select auth.uid()), k.key))
                 from (select jsonb_object_keys(p.limits) as key
                         from public.plans p where p.key = 'free') as k),
    'purchases', (select coalesce(jsonb_agg(jsonb_build_object(
                           'plan', u.plan_key, 'type', u.type, 'valid_until', u.valid_until)), '[]'::jsonb)
                    from public.purchases u
                   where u.user_id = (select auth.uid()) and u.status = 'active'));
$$;
grant execute on function public.my_plan() to anon, authenticated;

-- Webhook / reconcile writer (service role only). The Edge Function re-fetches the
-- Stripe object first, so writing its current state is idempotent and order-safe.
-- p_row: {type, user_id, plan_key, status, valid_until?, stripe ids, amount_cents?, currency?}
create function public.billing_upsert(p_row jsonb) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if p_row ->> 'type' = 'subscription' then
    insert into public.purchases as u (user_id, plan_key, type, status, valid_until,
                                       stripe_subscription_id, amount_cents, currency)
    values ((p_row ->> 'user_id')::uuid, p_row ->> 'plan_key', 'subscription', p_row ->> 'status',
            (p_row ->> 'valid_until')::timestamptz, p_row ->> 'stripe_subscription_id',
            (p_row ->> 'amount_cents')::integer, p_row ->> 'currency')
    on conflict (stripe_subscription_id) do update
      set plan_key = excluded.plan_key, status = excluded.status,
          valid_until = excluded.valid_until, updated_at = now();
    return;
  end if;
  insert into public.purchases as u (user_id, plan_key, type, status, stripe_checkout_session_id,
                                     stripe_payment_intent_id, amount_cents, currency)
  values ((p_row ->> 'user_id')::uuid, p_row ->> 'plan_key', 'one_time', p_row ->> 'status',
          p_row ->> 'stripe_checkout_session_id', p_row ->> 'stripe_payment_intent_id',
          (p_row ->> 'amount_cents')::integer, p_row ->> 'currency')
  on conflict (stripe_checkout_session_id) do update
    set status = excluded.status,
        stripe_payment_intent_id = coalesce(excluded.stripe_payment_intent_id, u.stripe_payment_intent_id),
        updated_at = now();
end;
$$;
revoke execute on function public.billing_upsert(jsonb) from anon, authenticated;
grant execute on function public.billing_upsert(jsonb) to service_role;

alter table public.plans     enable row level security;
alter table public.purchases enable row level security;
revoke all on public.plans, public.purchases from anon, authenticated;
grant select on public.plans to anon, authenticated;
grant select on public.purchases to authenticated;
create policy plans_read on public.plans for select to anon, authenticated using (true);
create policy purchases_own on public.purchases for select to authenticated
  using (user_id = (select auth.uid()));

-- `builder: 1` on the free plan = builder free for everyone (alpha/beta); set 0 at GA.
insert into public.plans (key, name, billing, billing_interval, is_active, limits) values
  ('free', 'Free', 'free', null, true,
   '{"cloud_enabled": 1, "builder": 1, "cloud_private_items": 10, "public_items": 50,
     "collections": 20, "revision_history": 10, "cloud_device_backups": 5,
     "cloud_storage_mb": 25, "max_devices": 0}'),
  ('beta_tester', 'Beta tester', 'comp', null, false, '{"cloud_enabled": 1}');

insert into public.plans (key, name, billing, billing_interval, is_active, limits)
select p.key, p.name, p.billing, p.billing_interval, false,
       '{"cloud_enabled": 1, "builder": 1, "cloud_private_items": 200, "public_items": 500,
         "collections": 200, "revision_history": 50, "cloud_device_backups": 50,
         "cloud_storage_mb": 250, "max_devices": 3}'::jsonb
  from (values ('builder_lifetime', 'Remappr Builder — Lifetime', 'one_time',     null),
               ('builder_monthly',  'Remappr Builder — Monthly',  'subscription', 'month'),
               ('builder_yearly',   'Remappr Builder — Yearly',   'subscription', 'year'))
       as p (key, name, billing, billing_interval);
