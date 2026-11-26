// pattern-check: skip — tests for the pure Stripe → purchase row mappings.
//
// deno test --node-modules-dir=none supabase/functions/_shared/stripe.test.ts
import { assertEquals } from 'jsr:@std/assert@1'
import {
    allowedReturnOrigin,
    disputeRow,
    graceUntil,
    invoiceSubscription,
    refundRow,
    sessionRow,
    subscriptionRow,
    subscriptionStatus,
} from './stripe.ts'

const sub = (status: string, ends: number[]) => ({
    id: 'sub_1',
    status,
    metadata: { user_id: 'u1', plan_key: 'builder_monthly' },
    items: {
        data: ends.map((end) => ({
            current_period_end: end,
            price: { id: 'price_1', unit_amount: 500, currency: 'eur' },
        })),
    },
})

Deno.test('subscription statuses: what still pays counts', () => {
    for (const s of ['trialing', 'active', 'past_due'])
        assertEquals(subscriptionStatus(s), 'active')
    assertEquals(subscriptionStatus('incomplete'), 'pending')
    for (const s of ['canceled', 'unpaid', 'incomplete_expired', 'paused'])
        assertEquals(subscriptionStatus(s), 'ended')
})

Deno.test(
    'a subscription row runs to its latest item period plus grace',
    () => {
        const row = subscriptionRow(
            sub('active', [1_000, 2_000]),
            'builder_yearly',
        )
        assertEquals(row, {
            type: 'subscription',
            user_id: 'u1',
            plan_key: 'builder_yearly',
            status: 'active',
            valid_until: graceUntil(2_000),
            stripe_subscription_id: 'sub_1',
            amount_cents: 500,
            currency: 'eur',
        })
        assertEquals(graceUntil(0), new Date(7 * 86_400 * 1000).toISOString())
    },
)

Deno.test(
    'one-time sessions: paid, waiting, expired; subscriptions skipped',
    () => {
        const base = {
            id: 'cs_1',
            mode: 'payment',
            status: 'complete',
            payment_status: 'paid',
            payment_intent: { id: 'pi_1' },
            metadata: { user_id: 'u1', plan_key: 'builder_lifetime' },
            amount_total: 4900,
            currency: 'eur',
        }
        assertEquals(sessionRow(base)?.status, 'active')
        assertEquals(sessionRow(base)?.stripe_payment_intent_id, 'pi_1')
        assertEquals(
            sessionRow({ ...base, payment_status: 'unpaid', status: 'open' })
                ?.status,
            'pending',
        )
        assertEquals(
            sessionRow({ ...base, payment_status: 'unpaid', status: 'expired' })
                ?.status,
            'failed',
        )
        assertEquals(sessionRow({ ...base, mode: 'subscription' }), null)
    },
)

Deno.test(
    'refunds count only when full; disputes flip and come back when won',
    () => {
        assertEquals(
            refundRow({ refunded: false, payment_intent: 'pi_1' }),
            null,
        )
        assertEquals(
            refundRow({ refunded: true, payment_intent: 'pi_1' })?.status,
            'refunded',
        )
        assertEquals(
            disputeRow({ status: 'needs_response', payment_intent: 'pi_1' })
                ?.status,
            'disputed',
        )
        assertEquals(
            disputeRow({ status: 'won', payment_intent: 'pi_1' })?.status,
            'active',
        )
        assertEquals(
            disputeRow({ status: 'lost', payment_intent: 'pi_1' })?.status,
            'disputed',
        )
    },
)

Deno.test('an invoice names its subscription in either API shape', () => {
    assertEquals(
        invoiceSubscription({
            parent: { subscription_details: { subscription: 'sub_1' } },
        }),
        'sub_1',
    )
    assertEquals(
        invoiceSubscription({ subscription: { id: 'sub_2' } }),
        'sub_2',
    )
    assertEquals(invoiceSubscription({}), null)
})

Deno.test('Checkout returns only to allowed origins and PR previews', () => {
    assertEquals(
        allowedReturnOrigin('https://remappr.com/app?x=1', undefined),
        'https://remappr.com',
    )
    assertEquals(
        allowedReturnOrigin('http://[::1]:5173/', undefined),
        'http://[::1]:5173',
    )
    assertEquals(
        allowedReturnOrigin(
            'https://pr-214.remappr-preview.pages.dev/',
            undefined,
        ),
        'https://pr-214.remappr-preview.pages.dev',
    )
    assertEquals(allowedReturnOrigin('https://evil.example/', undefined), null)
    assertEquals(
        allowedReturnOrigin('https://remappr.com.evil.example/', undefined),
        null,
    )
    assertEquals(allowedReturnOrigin('not a url', undefined), null)
    assertEquals(
        allowedReturnOrigin(
            'https://a.test/',
            'https://a.test, https://b.test',
        ),
        'https://a.test',
    )
    assertEquals(
        allowedReturnOrigin('https://remappr.com/', 'https://a.test'),
        null,
    )
})
