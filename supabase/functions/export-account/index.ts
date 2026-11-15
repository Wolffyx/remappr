// pattern-check: skip — one request handler: authenticate, dump, reply.
//
// POST with the user's bearer token. Replies with everything kept about the
// caller as one JSON document (account_export, plan §7). Billing details live
// in Stripe; P6 adds them here, fetched live.
import { adminClient, callerId, json, preflight } from '../_shared/http.ts'

Deno.serve(async (req) => {
    const early = preflight(req)
    if (early) return early
    const uid = await callerId(req)
    if (!uid) return json({ error: 'not_authenticated' }, 401)

    const { data, error } = await adminClient().rpc('account_export', {
        p_user: uid,
    })
    if (error) {
        console.error('[export-account]', error.message)
        return json({ error: 'export_failed' }, 500)
    }
    return json(data)
})
