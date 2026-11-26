// pattern-check: skip — one request handler: the caller's Stripe customer →
// a Billing Portal session.
//
// POST { returnTo } with the user's bearer token → { url } of Stripe's
// Billing Portal: cancel, switch plan, invoices, billing details. None for a
// user who never checked out.
import { adminClient, callerId, json, preflight } from '../_shared/http.ts'
import { allowedReturnOrigin, stripeClient } from '../_shared/stripe.ts'

Deno.serve(async (req) => {
    const early = preflight(req)
    if (early) return early
    const uid = await callerId(req)
    if (!uid) return json({ error: 'not_authenticated' }, 401)

    const body = (await req.json().catch(() => ({}))) as { returnTo?: string }
    const returnTo = body.returnTo ?? ''
    if (!allowedReturnOrigin(returnTo, Deno.env.get('CHECKOUT_RETURN_ORIGINS')))
        return json({ error: 'bad_return' }, 400)

    const { data: found } = await adminClient().auth.admin.getUserById(uid)
    const customer = found.user?.app_metadata?.stripe_customer_id as
        | string
        | undefined
    if (!customer) return json({ error: 'no_billing' }, 404)

    try {
        const session = await stripeClient().billingPortal.sessions.create({
            customer,
            return_url: returnTo,
        })
        return json({ url: session.url })
    } catch (e) {
        console.error('[portal]', e instanceof Error ? e.message : e)
        return json({ error: 'portal_failed' }, 502)
    }
})
