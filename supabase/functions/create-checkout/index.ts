// pattern-check: skip — one request handler: check the plan and the caller,
// get or make their Stripe customer, open a Checkout Session.
//
// POST { planKey, returnTo } with the user's bearer token → { url } of a
// Stripe-hosted Checkout (card details never reach Remappr). Refused for a
// plan that is not on sale, a return address off the allowlist, or a
// purchase the caller already has (a lifetime, or a running subscription:
// that one is changed in the Billing Portal).
import { adminClient, callerId, json, preflight } from '../_shared/http.ts'
import { allowedReturnOrigin, stripeClient } from '../_shared/stripe.ts'

Deno.serve(async (req) => {
    const early = preflight(req)
    if (early) return early
    const uid = await callerId(req)
    if (!uid) return json({ error: 'not_authenticated' }, 401)

    const body = (await req.json().catch(() => ({}))) as {
        planKey?: string
        returnTo?: string
    }
    const returnTo = body.returnTo ?? ''
    const origin = allowedReturnOrigin(
        returnTo,
        Deno.env.get('CHECKOUT_RETURN_ORIGINS'),
    )
    if (!origin) return json({ error: 'bad_return' }, 400)

    const admin = adminClient()
    const { data: plan, error: planError } = await admin
        .from('plans')
        .select('key, billing, stripe_price_id, is_active')
        .eq('key', body.planKey ?? '')
        .maybeSingle()
    if (planError) {
        console.error('[checkout] plan', planError.message)
        return json({ error: 'checkout_failed' }, 500)
    }
    const sellable =
        plan?.is_active &&
        plan.stripe_price_id &&
        (plan.billing === 'one_time' || plan.billing === 'subscription')
    if (!plan || !sellable) return json({ error: 'plan_unavailable' }, 404)

    const { data: owned, error: ownedError } = await admin
        .from('purchases')
        .select('type, valid_until')
        .eq('user_id', uid)
        .eq('status', 'active')
    if (ownedError) {
        console.error('[checkout] purchases', ownedError.message)
        return json({ error: 'checkout_failed' }, 500)
    }
    const live = (owned ?? []).filter(
        (p) => !p.valid_until || new Date(p.valid_until) > new Date(),
    )
    if (live.some((p) => p.type === 'one_time'))
        return json({ error: 'already_owned' }, 409)
    if (
        plan.billing === 'subscription' &&
        live.some((p) => p.type === 'subscription')
    )
        return json({ error: 'already_subscribed' }, 409)

    const stripe = stripeClient()
    try {
        const { data: found } = await admin.auth.admin.getUserById(uid)
        const user = found.user
        let customer = user?.app_metadata?.stripe_customer_id as
            | string
            | undefined
        if (!customer) {
            const made = await stripe.customers.create(
                { email: user?.email, metadata: { user_id: uid } },
                // A retried first checkout must not make a second customer.
                { idempotencyKey: `cust:${uid}` },
            )
            customer = made.id
            const { error } = await admin.auth.admin.updateUserById(uid, {
                app_metadata: {
                    ...user?.app_metadata,
                    stripe_customer_id: customer,
                },
            })
            if (error) throw new Error(`customer id: ${error.message}`)
        }

        const meta = { user_id: uid, plan_key: plan.key as string }
        const subscription = plan.billing === 'subscription'
        const session = await stripe.checkout.sessions.create({
            mode: subscription ? 'subscription' : 'payment',
            customer,
            client_reference_id: uid,
            line_items: [
                { price: plan.stripe_price_id as string, quantity: 1 },
            ],
            // Stripe Tax needs the account's origin address; on when set up.
            automatic_tax: {
                enabled: Deno.env.get('STRIPE_AUTOMATIC_TAX') === 'on',
            },
            customer_update: { address: 'auto', name: 'auto' },
            metadata: meta,
            ...(subscription
                ? { subscription_data: { metadata: meta } }
                : {
                      payment_intent_data: { metadata: meta },
                      invoice_creation: { enabled: true },
                  }),
            success_url: `${origin}/checkout/done.html?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: returnTo,
        })
        return json({ url: session.url })
    } catch (e) {
        console.error('[checkout]', e instanceof Error ? e.message : e)
        return json({ error: 'checkout_failed' }, 502)
    }
})
