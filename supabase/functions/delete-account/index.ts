// pattern-check: skip — one request handler: authenticate, confirm, clean up,
// delete the auth user (the cascade does the rest).
//
// POST { confirm } with the user's bearer token; confirm must be the account's
// email. A running subscription is cancelled at Stripe first (with Stripe set
// up); without Stripe the delete is refused while one still bills.
// Removes the user's device images, then the auth user: that cascades the
// profile, library, versions, stars, reports and licensed devices. Comments
// stay as "[deleted]" without their text; purchases stay, unlinked, for tax
// records.
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.118.0'
import { adminClient, callerId, json, preflight } from '../_shared/http.ts'
import { stripeClient } from '../_shared/stripe.ts'
import { applyEvent } from '../_shared/stripeEvents.ts'

const BUCKET = 'device-images'
// Storage removes at most this many objects per call.
const REMOVE_BATCH = 1000

/** Cancel the user's running subscriptions now and record them as ended
 *  (the webhook would too, later). Nothing to do without Stripe. */
async function cancelSubscriptions(
    admin: SupabaseClient,
    uid: string,
): Promise<void> {
    if (!Deno.env.get('STRIPE_SECRET_KEY')) return
    const { data, error } = await admin
        .from('purchases')
        .select('stripe_subscription_id')
        .eq('user_id', uid)
        .eq('type', 'subscription')
        .eq('status', 'active')
    if (error) throw new Error(`purchases: ${error.message}`)
    const stripe = stripeClient()
    for (const row of data ?? []) {
        const id = row.stripe_subscription_id as string | null
        if (!id) continue
        await stripe.subscriptions.cancel(id)
        await applyEvent(
            { stripe, admin },
            { type: 'customer.subscription.deleted', data: { object: { id } } },
        )
    }
}

Deno.serve(async (req) => {
    const early = preflight(req)
    if (early) return early
    const uid = await callerId(req)
    if (!uid) return json({ error: 'not_authenticated' }, 401)

    const body = (await req.json().catch(() => ({}))) as { confirm?: string }
    const admin = adminClient()
    const { data: found } = await admin.auth.admin.getUserById(uid)
    const email = found.user?.email?.toLowerCase() ?? ''
    if (!email || body.confirm?.trim().toLowerCase() !== email)
        return json({ error: 'confirm_mismatch' }, 400)

    try {
        await cancelSubscriptions(admin, uid)
    } catch (e) {
        console.error(
            '[delete-account] cancel',
            e instanceof Error ? e.message : e,
        )
        return json({ error: 'delete_failed' }, 502)
    }

    const { data: objects, error: prepError } = await admin.rpc(
        'account_prepare_delete',
        { p_user: uid },
    )
    if (prepError) {
        const known = prepError.message === 'active_subscription'
        if (!known) console.error('[delete-account] prepare', prepError.message)
        return json(
            { error: known ? 'active_subscription' : 'delete_failed' },
            known ? 409 : 500,
        )
    }

    const names = (objects ?? []) as string[]
    for (let i = 0; i < names.length; i += REMOVE_BATCH) {
        const { error } = await admin.storage
            .from(BUCKET)
            .remove(names.slice(i, i + REMOVE_BATCH))
        if (error) {
            console.error('[delete-account] storage', error.message)
            return json({ error: 'delete_failed' }, 500)
        }
    }

    const { error } = await admin.auth.admin.deleteUser(uid)
    if (error) {
        console.error('[delete-account] auth', error.message)
        return json({ error: 'delete_failed' }, 500)
    }
    return json({ deleted: true })
})
