// pattern-check: skip — a one-off setup script: Stripe REST calls and SQL text.
//
// Creates (or finds again) the Stripe products and prices for the paid plans
// and prints the SQL that connects `public.plans` to them. Run it per
// environment with that environment's key (test mode first):
//
//   STRIPE_SECRET_KEY=sk_test_… node --no-warnings scripts/stripe-plans.ts \
//       --currency eur --lifetime 4900 --monthly 499 --yearly 4900
//
// Amounts are in cents. Prices are found again by their lookup key, so
// running it twice makes nothing new; a changed amount makes a new price (a
// Stripe price never changes) and moves the lookup key to it. Paste the
// printed SQL into the SQL editor of that environment's Supabase project.
import { parseArgs } from 'node:util'

const API = 'https://api.stripe.com/v1'

interface PlanSpec {
    key: string
    product: string
    interval: 'month' | 'year' | null
    amount: number
}

const { values } = parseArgs({
    options: {
        currency: { type: 'string', default: 'eur' },
        lifetime: { type: 'string' },
        monthly: { type: 'string' },
        yearly: { type: 'string' },
    },
})

function cents(name: string, value: string | undefined): number {
    const n = Number(value)
    if (!value || !Number.isInteger(n) || n <= 0)
        throw new Error(`--${name} needs a price in cents, e.g. --${name} 499`)
    return n
}

async function stripe<T>(
    key: string,
    method: 'GET' | 'POST',
    path: string,
    params: Record<string, string> = {},
): Promise<T> {
    const body = new URLSearchParams(params).toString()
    const res = await fetch(
        method === 'GET' ? `${API}${path}?${body}` : `${API}${path}`,
        {
            method,
            headers: {
                Authorization: `Bearer ${key}`,
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: method === 'POST' ? body : undefined,
        },
    )
    const json = (await res.json()) as T & { error?: { message: string } }
    if (!res.ok)
        throw new Error(`Stripe ${path}: ${json.error?.message ?? res.status}`)
    return json
}

interface Price {
    id: string
    unit_amount: number
    currency: string
    product: string
}

async function ensurePrice(
    key: string,
    spec: PlanSpec,
    currency: string,
): Promise<Price> {
    const lookup = `remappr_${spec.key}`
    const found = await stripe<{ data: Price[] }>(key, 'GET', '/prices', {
        'lookup_keys[]': lookup,
        active: 'true',
    })
    const same = found.data.find(
        (p) => p.unit_amount === spec.amount && p.currency === currency,
    )
    if (same) return same
    const product =
        found.data[0]?.product ??
        (
            await stripe<{ id: string }>(key, 'POST', '/products', {
                name: spec.product,
                'metadata[plan_key]': spec.key,
            })
        ).id
    return stripe<Price>(key, 'POST', '/prices', {
        product,
        currency,
        unit_amount: String(spec.amount),
        lookup_key: lookup,
        transfer_lookup_key: 'true',
        'metadata[plan_key]': spec.key,
        ...(spec.interval ? { 'recurring[interval]': spec.interval } : {}),
    })
}

async function main(): Promise<void> {
    const key = process.env.STRIPE_SECRET_KEY
    if (!key) throw new Error('Set STRIPE_SECRET_KEY (test mode first).')
    const currency = (values.currency ?? 'eur').toLowerCase()
    const specs: PlanSpec[] = [
        {
            key: 'builder_lifetime',
            product: 'Remappr Builder — Lifetime',
            interval: null,
            amount: cents('lifetime', values.lifetime),
        },
        {
            key: 'builder_monthly',
            product: 'Remappr Builder — Monthly',
            interval: 'month',
            amount: cents('monthly', values.monthly),
        },
        {
            key: 'builder_yearly',
            product: 'Remappr Builder — Yearly',
            interval: 'year',
            amount: cents('yearly', values.yearly),
        },
    ]
    const mode =
        key.startsWith('sk_live') || key.startsWith('rk_live') ? 'LIVE' : 'test'
    console.log(`-- Stripe ${mode} mode, ${new Date().toISOString()}`)
    for (const spec of specs) {
        const price = await ensurePrice(key, spec, currency)
        console.log(
            `update public.plans set stripe_price_id = '${price.id}', amount_cents = ${price.unit_amount}, ` +
                `currency = '${price.currency}', is_active = true where key = '${spec.key}';`,
        )
    }
}

main().catch((e: unknown) => {
    console.error(e instanceof Error ? e.message : e)
    process.exit(1)
})
