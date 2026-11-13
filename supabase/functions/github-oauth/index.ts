// Pattern check: Dispatch Map (Tier 0) — applied — one handler per action
// (exchange, refresh, revoke), looked up by name.
//
// Connect GitHub (plan §6c A2, P10e): the Remappr GitHub App's user tokens
// need the app's client secret to issue and refresh, so the app asks here.
// No Remappr account is needed. The tokens go straight back to the caller and
// are never stored here.
//
// POST { action: 'exchange', code, redirectUri, codeVerifier }
//    | { action: 'refresh', refreshToken }
//    | { action: 'revoke', accessToken }
// → GitHub's token reply ({ access_token, expires_in, refresh_token,
//   refresh_token_expires_in, … }) or { ok: true } for revoke.
// Secrets: GITHUB_APP_CLIENT_ID, GITHUB_APP_CLIENT_SECRET.
import { json, preflight } from '../_shared/http.ts'

const TOKEN_URL = 'https://github.com/login/oauth/access_token'
const CODE_RE = /^[A-Za-z0-9_-]{8,64}$/
const VERIFIER_RE = /^[A-Za-z0-9._~-]{43,128}$/
const TOKEN_RE = /^gh[a-z]_[A-Za-z0-9_]{20,255}$/

interface Body {
    action?: unknown
    code?: unknown
    redirectUri?: unknown
    codeVerifier?: unknown
    refreshToken?: unknown
    accessToken?: unknown
}

interface App {
    clientId: string
    clientSecret: string
}

function app(): App | null {
    const clientId = Deno.env.get('GITHUB_APP_CLIENT_ID')
    const clientSecret = Deno.env.get('GITHUB_APP_CLIENT_SECRET')
    return clientId && clientSecret ? { clientId, clientSecret } : null
}

const isText = (v: unknown, re: RegExp): v is string =>
    typeof v === 'string' && re.test(v)

/** An https URL, or http on localhost (dev servers). */
function isRedirect(v: unknown): v is string {
    if (typeof v !== 'string') return false
    try {
        const u = new URL(v)
        if (u.protocol === 'https:') return true
        return (
            u.protocol === 'http:' &&
            ['localhost', '127.0.0.1'].includes(u.hostname)
        )
    } catch {
        return false
    }
}

/** GitHub's token endpoint; its errors come back as 200 + { error }. */
async function tokenRequest(params: Record<string, string>): Promise<Response> {
    const res = await fetch(TOKEN_URL, {
        method: 'POST',
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams(params),
    })
    const reply = (await res.json().catch(() => ({}))) as Record<
        string,
        unknown
    >
    if (!res.ok || typeof reply.error === 'string')
        return json(
            {
                error:
                    typeof reply.error === 'string'
                        ? reply.error
                        : `github_${res.status}`,
                description: reply.error_description,
            },
            400,
        )
    return json(reply)
}

type Handler = (body: Body, app: App) => Promise<Response>

const ACTIONS: Record<string, Handler> = {
    exchange: (b, a) => {
        if (
            !isText(b.code, CODE_RE) ||
            !isRedirect(b.redirectUri) ||
            !isText(b.codeVerifier, VERIFIER_RE)
        )
            return Promise.resolve(json({ error: 'bad_request' }, 400))
        return tokenRequest({
            client_id: a.clientId,
            client_secret: a.clientSecret,
            code: b.code,
            redirect_uri: b.redirectUri,
            code_verifier: b.codeVerifier,
        })
    },
    refresh: (b, a) => {
        if (!isText(b.refreshToken, TOKEN_RE))
            return Promise.resolve(json({ error: 'bad_request' }, 400))
        return tokenRequest({
            client_id: a.clientId,
            client_secret: a.clientSecret,
            grant_type: 'refresh_token',
            refresh_token: b.refreshToken,
        })
    },
    // Disconnect: revoke this authorization on GitHub too (basic auth with
    // the app's credentials, per GitHub's "delete an app authorization").
    revoke: async (b, a) => {
        if (!isText(b.accessToken, TOKEN_RE))
            return json({ error: 'bad_request' }, 400)
        const res = await fetch(
            `https://api.github.com/applications/${a.clientId}/grant`,
            {
                method: 'DELETE',
                headers: {
                    Accept: 'application/vnd.github+json',
                    Authorization: `Basic ${btoa(`${a.clientId}:${a.clientSecret}`)}`,
                    'Content-Type': 'application/json',
                    'X-GitHub-Api-Version': '2022-11-28',
                },
                body: JSON.stringify({ access_token: b.accessToken }),
            },
        )
        // 404: already revoked or expired; either way it is gone.
        return res.ok || res.status === 404
            ? json({ ok: true })
            : json({ error: `github_${res.status}` }, 502)
    },
}

Deno.serve(async (req) => {
    const early = preflight(req)
    if (early) return early
    if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)
    const credentials = app()
    if (!credentials) return json({ error: 'github_app_not_configured' }, 503)
    const body = (await req.json().catch(() => ({}))) as Body
    const handler =
        typeof body.action === 'string' ? ACTIONS[body.action] : undefined
    if (!handler) return json({ error: 'bad_request' }, 400)
    return handler(body, credentials)
})
