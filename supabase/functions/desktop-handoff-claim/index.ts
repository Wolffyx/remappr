// pattern-check: skip — one request handler: hash the nonce, take the login
// filed under it, once.
//
// POST { nonce } from the desktop app (no account: it is not signed in yet).
// Replies { tokenHash } (sign in with verifyOtp, type "email") once the
// browser has filed the login, { pending: true } before that, 400 for a
// malformed nonce. Each filed login is taken at most once.
import { adminClient, json, preflight } from '../_shared/http.ts'

const NONCE_RE = /^[A-Za-z0-9_-]{43}$/

async function stateOf(nonce: string): Promise<string> {
    const digest = await crypto.subtle.digest(
        'SHA-256',
        new TextEncoder().encode(nonce),
    )
    return btoa(String.fromCharCode(...new Uint8Array(digest)))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '')
}

Deno.serve(async (req) => {
    const early = preflight(req)
    if (early) return early
    const { nonce } = (await req.json().catch(() => ({}))) as {
        nonce?: string
    }
    if (!nonce || !NONCE_RE.test(nonce))
        return json({ error: 'bad_nonce' }, 400)

    const { data, error } = await adminClient().rpc('desktop_handoff_take', {
        p_state: await stateOf(nonce),
    })
    if (error) {
        console.error('[desktop-handoff-claim]', error.message)
        return json({ error: 'claim_failed' }, 500)
    }
    return data ? json({ tokenHash: data }) : json({ pending: true })
})
