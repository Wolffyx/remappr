// pattern-check: skip — one request handler: authenticate, mint a one-time
// login for the caller, file it under the app's state.
//
// POST { state } with the user's bearer token, from the site's desktop
// sign-in page. state is base64url(sha256(nonce)); the nonce stays in the
// desktop app. The login (a magic-link token hash) is filed under the state
// for desktop-handoff-claim and never returned here, so the browser, and
// anything that sees the state in a URL, holds nothing that signs in.
import { adminClient, callerId, json, preflight } from '../_shared/http.ts'

const STATE_RE = /^[A-Za-z0-9_-]{43}$/

Deno.serve(async (req) => {
    const early = preflight(req)
    if (early) return early
    const uid = await callerId(req)
    if (!uid) return json({ error: 'not_authenticated' }, 401)

    const { state } = (await req.json().catch(() => ({}))) as {
        state?: string
    }
    if (!state || !STATE_RE.test(state))
        return json({ error: 'bad_state' }, 400)

    const admin = adminClient()
    // Refuse a used state first: minting a link replaces the user's previous
    // one, which would void the login already filed under it.
    const { data: known } = await admin.rpc('desktop_handoff_known', {
        p_state: state,
    })
    if (known) return json({ error: 'state_used' }, 409)

    const { data: found } = await admin.auth.admin.getUserById(uid)
    const email = found.user?.email
    if (!email) return json({ error: 'no_email' }, 400)

    const { data: link, error } = await admin.auth.admin.generateLink({
        type: 'magiclink',
        email,
    })
    const tokenHash = link?.properties?.hashed_token
    if (error || !tokenHash) {
        console.error('[desktop-handoff] link', error?.message)
        return json({ error: 'handoff_failed' }, 500)
    }

    const { data: filed, error: putError } = await admin.rpc(
        'desktop_handoff_put',
        { p_state: state, p_user: uid, p_token_hash: tokenHash },
    )
    if (putError) {
        console.error('[desktop-handoff] put', putError.message)
        return json({ error: 'handoff_failed' }, 500)
    }
    if (!filed) return json({ error: 'state_used' }, 409)
    return json({ ok: true })
})
