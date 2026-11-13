// Pattern check: Dispatch Map (Tier 0) — applied — Stripe event type → its
// handler, shared by stripe-webhook and billing-reconcile.
//
// Every handler re-fetches the Stripe object the event names and writes its
// current state through billing_upsert, so a replayed, late or out-of-order
// event is harmless and no event log is kept.
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.118.0'
import {
    disputeRow,
    invoiceSubscription,
    refundRow,
    sessionRow,
    type Stripe,
    subscriptionRow,
    type SubscriptionLike,
} from './stripe.ts'

export interface BillingContext {
    stripe: Stripe
    admin: SupabaseClient
}

type Handler = (ctx: BillingContext, objectId: string) => Promise<void>

async function write(
    ctx: BillingContext,
    row: Record<string, unknown> | null,
): Promise<void> {
    if (!row) return
    const { error } = await ctx.admin.rpc('billing_upsert', { p_row: row })
    if (error) throw new Error(`billing_upsert: ${error.message}`)
}

/** The plan sold at this price; the subscription's own metadata otherwise. */
async function planOf(
    ctx: BillingContext,
    priceId: string | undefined,
    fallback: string | undefined,
): Promise<string | null> {
    if (priceId) {
        const { data, error } = await ctx.admin
            .from('plans')
            .select('key')
            .eq('stripe_price_id', priceId)
            .maybeSingle()
        if (error) throw new Error(`plans: ${error.message}`)
        if (data) return data.key as string
    }
    return fallback ?? null
}

const onSubscription: Handler = async (ctx, id) => {
    const sub = (await ctx.stripe.subscriptions.retrieve(
        id,
    )) as unknown as SubscriptionLike
    const plan = await planOf(
        ctx,
        sub.items.data[0]?.price.id,
        sub.metadata.plan_key,
    )
    if (!plan || !sub.metadata.user_id) {
        console.warn('[billing] subscription without a plan or user', id)
        return
    }
    await write(ctx, subscriptionRow(sub, plan))
}

const onSession: Handler = async (ctx, id) => {
    const session = await ctx.stripe.checkout.sessions.retrieve(id)
    const subscription = session.subscription
    if (session.mode === 'subscription') {
        const subId =
            typeof subscription === 'string' ? subscription : subscription?.id
        if (subId) await onSubscription(ctx, subId)
        return
    }
    const row = sessionRow(
        session as unknown as Parameters<typeof sessionRow>[0],
    )
    if (row && (!row.user_id || !row.plan_key)) {
        console.warn('[billing] session without a user or plan', id)
        return
    }
    await write(ctx, row)
}

const onInvoice: Handler = async (ctx, id) => {
    const invoice = await ctx.stripe.invoices.retrieve(id)
    const sub = invoiceSubscription(
        invoice as unknown as Parameters<typeof invoiceSubscription>[0],
    )
    if (sub) await onSubscription(ctx, sub)
}

const onCharge: Handler = async (ctx, id) => {
    const charge = await ctx.stripe.charges.retrieve(id)
    await write(ctx, refundRow(charge))
}

const onDispute: Handler = async (ctx, id) => {
    const dispute = await ctx.stripe.disputes.retrieve(id)
    await write(ctx, disputeRow(dispute))
}

const HANDLERS: Record<string, Handler> = {
    'checkout.session.completed': onSession,
    'checkout.session.async_payment_succeeded': onSession,
    'checkout.session.async_payment_failed': onSession,
    'checkout.session.expired': onSession,
    'customer.subscription.created': onSubscription,
    'customer.subscription.updated': onSubscription,
    'customer.subscription.deleted': onSubscription,
    'customer.subscription.paused': onSubscription,
    'customer.subscription.resumed': onSubscription,
    'invoice.paid': onInvoice,
    'invoice.payment_failed': onInvoice,
    'charge.refunded': onCharge,
    'charge.dispute.created': onDispute,
    'charge.dispute.updated': onDispute,
    'charge.dispute.closed': onDispute,
}

/** The event types billing listens to (the webhook endpoint's list). */
export const BILLING_EVENTS: readonly string[] = Object.keys(HANDLERS)

/** Apply one event; false when billing does not handle its type. */
export async function applyEvent(
    ctx: BillingContext,
    event: { type: string; data: { object: unknown } },
): Promise<boolean> {
    const handler = HANDLERS[event.type]
    const id = (event.data.object as { id?: unknown } | null)?.id
    if (!handler || typeof id !== 'string') return false
    await handler(ctx, id)
    return true
}
