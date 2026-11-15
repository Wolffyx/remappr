// pattern-check: skip — one request handler: replay the recent billing events
// through the webhook's dispatch map.
//
// Called nightly by pg_cron (migration 960) with x-cron-secret. Replays the
// last RECONCILE_DAYS of Stripe events, oldest first, through the same
// handlers as the webhook: they re-fetch current state, so a missed or failed
// webhook is healed and the rest is rewritten unchanged.
import { adminClient, json } from '../_shared/http.ts'
import { stripeClient } from '../_shared/stripe.ts'
import { applyEvent, BILLING_EVENTS } from '../_shared/stripeEvents.ts'

const RECONCILE_DAYS = 3

/** Equal strings, without leaking where they differ through timing. */
function sameSecret(a: string, b: string): boolean {
    if (a.length !== b.length) return false
    let diff = 0
    for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
    return diff === 0
}

Deno.serve(async (req) => {
    const secret = Deno.env.get('BILLING_RECONCILE_SECRET') ?? ''
    const given = req.headers.get('x-cron-secret') ?? ''
    if (!secret || !sameSecret(given, secret))
        return json({ error: 'forbidden' }, 403)

    const stripe = stripeClient()
    const ctx = { stripe, admin: adminClient() }
    const since = Math.floor(Date.now() / 1000) - RECONCILE_DAYS * 86_400
    const events = []
    // A list call takes at most 20 types.
    for (let i = 0; i < BILLING_EVENTS.length; i += 20) {
        for await (const event of stripe.events.list({
            created: { gte: since },
            types: BILLING_EVENTS.slice(i, i + 20),
            limit: 100,
        }))
            events.push(event)
    }
    events.sort((a, b) => a.created - b.created)

    let applied = 0
    const failed: string[] = []
    for (const event of events) {
        try {
            if (await applyEvent(ctx, event)) applied++
        } catch (e) {
            console.error(
                '[reconcile]',
                event.id,
                e instanceof Error ? e.message : e,
            )
            failed.push(event.id)
        }
    }
    return json(
        { events: events.length, applied, failed },
        failed.length ? 500 : 200,
    )
})
