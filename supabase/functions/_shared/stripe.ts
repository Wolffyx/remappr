// pattern-check: skip — the Stripe client factory and pure mappings from
// Stripe objects to purchase rows; no abstraction.
//
// P6 billing (plan §7). The SDK and its API version are pinned together, so a
// Stripe upgrade is a deliberate change. Card and billing details never leave
// Stripe: only reference ids, plan, status and amounts are written.
import Stripe from 'npm:stripe@23.0.1'

export { Stripe }

/** The API version stripe@23.0.1 is built for. */
export const STRIPE_API_VERSION = '2026-09-30.endive'

/** Days a subscription still counts after its paid period (the offline
 *  licence's grace, plan §4). */
export const GRACE_DAYS = 7

export function stripeClient(): Stripe {
    const key = Deno.env.get('STRIPE_SECRET_KEY')
    if (!key) throw new Error('STRIPE_SECRET_KEY is not set')
    return new Stripe(key, {
        apiVersion: STRIPE_API_VERSION as Stripe.LatestApiVersion,
        httpClient: Stripe.createFetchHttpClient(),
    })
}

export type PurchaseStatus =
    | 'pending'
    | 'active'
    | 'ended'
    | 'refunded'
    | 'disputed'
    | 'failed'

/** A Stripe subscription status as ours: what still pays counts. */
export function subscriptionStatus(status: string): PurchaseStatus {
    if (status === 'trialing' || status === 'active' || status === 'past_due')
        return 'active'
    if (status === 'incomplete') return 'pending'
    return 'ended'
}

/** Seconds since the epoch → ISO, plus the grace days. */
export function graceUntil(periodEnd: number): string {
    return new Date((periodEnd + GRACE_DAYS * 86_400) * 1000).toISOString()
}

const idOf = (ref: unknown): string | null =>
    typeof ref === 'string'
        ? ref
        : ((ref as { id?: string } | null)?.id ?? null)

export interface SubscriptionLike {
    id: string
    status: string
    metadata: Record<string, string>
    items: {
        data: {
            current_period_end: number
            price: { id: string; unit_amount: number | null; currency: string }
        }[]
    }
}

/** A subscription as a billing_upsert row. `planKey` is the plan of its
 *  current price (a portal switch changes it). */
export function subscriptionRow(
    sub: SubscriptionLike,
    planKey: string,
): Record<string, unknown> {
    const items = sub.items.data
    // Under the pinned API the period lives on the items.
    const periodEnd = Math.max(0, ...items.map((i) => i.current_period_end))
    const price = items[0]?.price
    return {
        type: 'subscription',
        user_id: sub.metadata.user_id ?? null,
        plan_key: planKey,
        status: subscriptionStatus(sub.status),
        valid_until: periodEnd ? graceUntil(periodEnd) : null,
        stripe_subscription_id: sub.id,
        amount_cents: price?.unit_amount ?? null,
        currency: price?.currency ?? null,
    }
}

export interface SessionLike {
    id: string
    mode: string
    status: string | null
    payment_status: string
    payment_intent: unknown
    metadata: Record<string, string> | null
    amount_total: number | null
    currency: string | null
}

/** A one-time Checkout Session as a billing_upsert row; null for a
 *  subscription session (its subscription is written instead). */
export function sessionRow(s: SessionLike): Record<string, unknown> | null {
    if (s.mode !== 'payment') return null
    const paid =
        s.payment_status === 'paid' ||
        s.payment_status === 'no_payment_required'
    const status: PurchaseStatus = paid
        ? 'active'
        : s.status === 'expired'
          ? 'failed'
          : 'pending'
    return {
        type: 'one_time',
        user_id: s.metadata?.user_id ?? null,
        plan_key: s.metadata?.plan_key ?? null,
        status,
        stripe_checkout_session_id: s.id,
        stripe_payment_intent_id: idOf(s.payment_intent),
        amount_cents: s.amount_total,
        currency: s.currency,
    }
}

/** A charge's full refund as a payment row; null for a partial one. */
export function refundRow(charge: {
    refunded: boolean
    payment_intent: unknown
}): Record<string, unknown> | null {
    const pi = idOf(charge.payment_intent)
    if (!charge.refunded || !pi) return null
    return { type: 'payment', stripe_payment_intent_id: pi, status: 'refunded' }
}

/** A dispute as a payment row: open → disputed, won → active again. */
export function disputeRow(dispute: {
    status: string
    payment_intent: unknown
}): Record<string, unknown> | null {
    const pi = idOf(dispute.payment_intent)
    if (!pi) return null
    const status = dispute.status === 'won' ? 'active' : 'disputed'
    return { type: 'payment', stripe_payment_intent_id: pi, status }
}

/** The subscription an invoice bills (its shape moved between API versions). */
export function invoiceSubscription(invoice: {
    subscription?: unknown
    parent?: { subscription_details?: { subscription?: unknown } | null } | null
}): string | null {
    return (
        idOf(invoice.parent?.subscription_details?.subscription) ??
        idOf(invoice.subscription)
    )
}

const DEFAULT_RETURN_ORIGINS = [
    'https://remappr.com',
    'https://dev.remappr.com',
    'http://localhost:5173',
    'http://[::1]:5173',
]

/** The origin of `returnTo` when Checkout may send the user back there:
 *  the configured origins (CHECKOUT_RETURN_ORIGINS, comma separated) or a
 *  PR preview. Null otherwise. */
export function allowedReturnOrigin(
    returnTo: string,
    configured: string | undefined,
): string | null {
    let url: URL
    try {
        url = new URL(returnTo)
    } catch {
        return null
    }
    const allowed = configured
        ? configured
              .split(',')
              .map((o) => o.trim())
              .filter(Boolean)
        : DEFAULT_RETURN_ORIGINS
    if (allowed.includes(url.origin)) return url.origin
    const preview =
        url.protocol === 'https:' &&
        /^[a-z0-9-]+\.remappr-preview\.pages\.dev$/.test(url.hostname)
    return preview ? url.origin : null
}
