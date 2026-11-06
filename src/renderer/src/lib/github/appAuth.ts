// pattern-check: skip — pure helpers for the GitHub App's user authorization.
//
// Connect GitHub (plan §6c A2, P10e) uses the Remappr GitHub App's
// web-application flow with PKCE: the browser authorizes on github.com, comes
// back to the app's own auth/github.html with a code, and the github-oauth
// Edge Function swaps it for a user token (8 h) and a refresh token (6
// months). The app's client id and slug are public build values.
import { authSiteUrl } from '@/lib/cloud/authRedirect'

export interface GithubAppConfig {
    clientId: string
    /** The app's URL name, for its install / repository-access page. */
    slug: string
}

export function githubAppConfig(
    env: Pick<
        ImportMetaEnv,
        'VITE_GITHUB_APP_CLIENT_ID' | 'VITE_GITHUB_APP_SLUG'
    > = import.meta.env,
): GithubAppConfig | null {
    const clientId = env.VITE_GITHUB_APP_CLIENT_ID?.trim()
    const slug = env.VITE_GITHUB_APP_SLUG?.trim()
    return clientId && slug ? { clientId, slug } : null
}

/** Where GitHub returns: this build's site (the dev server in a dev run). */
export function githubRedirectUri(site: string = authSiteUrl()): string {
    return `${site}/auth/github.html`
}

function base64url(bytes: Uint8Array): string {
    let s = ''
    for (const b of bytes) s += String.fromCharCode(b)
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

const randomText = (): string =>
    base64url(crypto.getRandomValues(new Uint8Array(32)))

export interface PendingConnect {
    /** 43 characters, checked when the code comes back. */
    state: string
    verifier: string
    challenge: string
    redirectUri: string
}

/** A fresh state and PKCE pair for one connect attempt. */
export async function newPendingConnect(
    redirectUri: string = githubRedirectUri(),
): Promise<PendingConnect> {
    const verifier = randomText()
    const digest = await crypto.subtle.digest(
        'SHA-256',
        new TextEncoder().encode(verifier),
    )
    return {
        state: randomText(),
        verifier,
        challenge: base64url(new Uint8Array(digest)),
        redirectUri,
    }
}

export function authorizeUrl(
    config: GithubAppConfig,
    pending: PendingConnect,
): string {
    const q = new URLSearchParams({
        client_id: config.clientId,
        redirect_uri: pending.redirectUri,
        state: pending.state,
        code_challenge: pending.challenge,
        code_challenge_method: 'S256',
    })
    return `https://github.com/login/oauth/authorize?${q}`
}

/** The page where the user picks which repositories the app may use. */
export function installUrl(config: GithubAppConfig): string {
    return `https://github.com/apps/${encodeURIComponent(config.slug)}/installations/new`
}

export interface GithubTokens {
    accessToken: string
    /** Epoch ms; null when the app issues non-expiring tokens. */
    expiresAt: number | null
    refreshToken: string | null
    refreshExpiresAt: number | null
}

interface TokenReply {
    access_token?: unknown
    expires_in?: unknown
    refresh_token?: unknown
    refresh_token_expires_in?: unknown
}

const seconds = (v: unknown, now: number): number | null =>
    typeof v === 'number' && v > 0 ? now + v * 1000 : null

/** GitHub's token reply as stored tokens (expiry as absolute times). */
export function tokensFromReply(
    reply: TokenReply,
    now: number = Date.now(),
): GithubTokens | null {
    if (typeof reply.access_token !== 'string' || !reply.access_token)
        return null
    return {
        accessToken: reply.access_token,
        expiresAt: seconds(reply.expires_in, now),
        refreshToken:
            typeof reply.refresh_token === 'string'
                ? reply.refresh_token
                : null,
        refreshExpiresAt: seconds(reply.refresh_token_expires_in, now),
    }
}

/** Refresh this long before the access token runs out. */
export const REFRESH_MARGIN_MS = 2 * 60 * 1000

export type TokenFreshness = 'fresh' | 'refresh' | 'expired'

/** Whether stored tokens can be used as they are, need a refresh, or are
 *  past saving (the user connects again). */
export function freshness(
    tokens: GithubTokens,
    now: number = Date.now(),
): TokenFreshness {
    if (tokens.expiresAt === null || tokens.expiresAt - REFRESH_MARGIN_MS > now)
        return 'fresh'
    const refreshable =
        tokens.refreshToken !== null &&
        (tokens.refreshExpiresAt === null || tokens.refreshExpiresAt > now)
    return refreshable ? 'refresh' : 'expired'
}

/** The code inside whatever the user pasted: the bare code, or the whole
 *  remappr:// or auth/github.html URL. */
export function githubCodeFromPaste(text: string): string | null {
    const trimmed = text.trim()
    const ok = (c: string | null): c is string =>
        !!c && /^[A-Za-z0-9_-]{8,64}$/.test(c)
    if (ok(trimmed)) return trimmed
    try {
        const code = new URL(trimmed).searchParams.get('code')
        return ok(code) ? code : null
    } catch {
        return null
    }
}
