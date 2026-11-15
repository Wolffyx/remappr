// Pattern check: no GoF pattern (-) — rejected — thin calls to two Edge
// Functions and one table, plus a pure price label; mirrors lib/cloud/*.
//
// Buying a plan (P6). Checkout and the Billing Portal are Stripe-hosted pages:
// card and billing details never reach Remappr. The web app goes there and
// comes back; the desktop app opens them in the system browser and refreshes
// the plan when its window gets focus again.
import { authSiteUrl } from './authRedirect'
import { getCloudClient } from './client'
import { functionErrorCode } from './errors'

export interface PaidPlan {
    key: string
    name: string
    billing: 'one_time' | 'subscription'
    interval: 'month' | 'year' | null
    amountCents: number | null
    currency: string | null
}

const BILLING_ERRORS: Record<string, string> = {
    not_authenticated: 'Sign in to buy a plan.',
    plan_unavailable: 'That plan is not on sale right now.',
    already_owned: 'You already own Remappr Builder for life.',
    already_subscribed:
        'You already have a subscription; change it under Manage billing.',
    no_billing: 'Nothing has been bought with this account yet.',
    bad_return: 'This copy of Remappr cannot open checkout.',
}

/** The plans on sale here (is_active, with a Stripe price), cheapest first. */
export async function paidPlans(): Promise<PaidPlan[]> {
    const client = await getCloudClient()
    if (!client) return []
    const { data, error } = await client
        .from('plans')
        .select('key, name, billing, billing_interval, amount_cents, currency')
        .eq('is_active', true)
        .in('billing', ['one_time', 'subscription'])
        .not('stripe_price_id', 'is', null)
    if (error) throw error
    return data
        .map((p) => ({
            key: p.key,
            name: p.name,
            billing: p.billing as PaidPlan['billing'],
            interval: p.billing_interval as PaidPlan['interval'],
            amountCents: p.amount_cents,
            currency: p.currency,
        }))
        .sort((a, b) => (a.amountCents ?? 0) - (b.amountCents ?? 0))
}

/** "€4.99 / month", "€49 once"; null without a price. */
export function priceLabel(
    plan: Pick<PaidPlan, 'amountCents' | 'currency' | 'interval'>,
    locale?: string,
): string | null {
    if (plan.amountCents === null || !plan.currency) return null
    const amount = new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: plan.currency.toUpperCase(),
        minimumFractionDigits: plan.amountCents % 100 === 0 ? 0 : 2,
    }).format(plan.amountCents / 100)
    return plan.interval ? `${amount} / ${plan.interval}` : `${amount} once`
}

/** Where Stripe sends the user back: this page on the web, the site the
 *  desktop app signs in through otherwise (file:// has no address). */
export function billingReturnUrl(electron: boolean): string {
    return electron ? `${authSiteUrl()}/` : window.location.href
}

async function openStripePage(
    fn: 'create-checkout' | 'create-portal-session',
    body: Record<string, unknown>,
    electron: boolean,
): Promise<void> {
    const client = await getCloudClient()
    if (!client) throw new Error('This build has no Remappr cloud.')
    const { data, error } = await client.functions.invoke<{ url?: string }>(
        fn,
        { body: { ...body, returnTo: billingReturnUrl(electron) } },
    )
    if (error) {
        const code = await functionErrorCode(error)
        throw new Error(BILLING_ERRORS[code] ?? code)
    }
    if (!data?.url) throw new Error('Stripe did not answer.')
    if (electron) window.open(data.url, '_blank')
    else window.location.assign(data.url)
}

/** Open Stripe Checkout for a plan. */
export const startCheckout = (
    planKey: string,
    electron: boolean,
): Promise<void> => openStripePage('create-checkout', { planKey }, electron)

/** Open the Stripe Billing Portal (cancel, switch, invoices). */
export const openBillingPortal = (electron: boolean): Promise<void> =>
    openStripePage('create-portal-session', {}, electron)
