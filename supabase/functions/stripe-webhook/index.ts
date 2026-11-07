// pattern-check: skip — one request handler: verify Stripe's signature, then
// hand the event to the shared dispatch map.
//
// Stripe calls this for the events in BILLING_EVENTS. The signature (the
// endpoint's STRIPE_WEBHOOK_SECRET) is the only auth. Each handler re-fetches
// what the event names, so retries and out-of-order deliveries are harmless.
// A failure answers 500 so Stripe retries; the nightly reconcile is the net.
import { adminClient, json } from '../_shared/http.ts'
import { Stripe, stripeClient } from '../_shared/stripe.ts'
import { applyEvent } from '../_shared/stripeEvents.ts'

const crypto = Stripe.createSubtleCryptoProvider()

Deno.serve(async (req) => {
    if (req.method !== 'POST') return json({ error: 'method' }, 405)
    const secret = Deno.env.get('STRIPE_WEBHOOK_SECRET')
    const signature = req.headers.get('Stripe-Signature')
    if (!secret || !signature) return json({ error: 'unsigned' }, 400)

    const stripe = stripeClient()
    let event: Stripe.Event
    try {
        event = await stripe.webhooks.constructEventAsync(
            await req.text(),
            signature,
            secret,
            undefined,
            crypto,
        )
    } catch (e) {
        console.warn(
            '[webhook] bad signature',
            e instanceof Error ? e.message : e,
        )
        return json({ error: 'bad_signature' }, 400)
    }

    try {
        const handled = await applyEvent(
            { stripe, admin: adminClient() },
            event,
        )
        return json({ received: true, handled })
    } catch (e) {
        console.error(
            '[webhook]',
            event.type,
            e instanceof Error ? e.message : e,
        )
        return json({ error: 'apply_failed' }, 500)
    }
})
