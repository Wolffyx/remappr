// pattern-check: skip — one request handler: authenticate, confirm, clean up,
// delete the auth user (the cascade does the rest).
//
// POST { confirm } with the user's bearer token; confirm must be the account's
// email. Refused while a subscription still bills (P6 cancels it first).
// Removes the user's device images, then the auth user: that cascades the
// profile, library, versions, stars, reports and licensed devices. Comments
// stay as "[deleted]" without their text; purchases stay, unlinked, for tax
// records.
import { adminClient, callerId, json, preflight } from '../_shared/http.ts'

const BUCKET = 'device-images'
// Storage removes at most this many objects per call.
const REMOVE_BATCH = 1000

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
