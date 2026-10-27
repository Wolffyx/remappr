// Pattern check: no GoF pattern (-) — rejected — nonce and state helpers plus a polling loop with one cancel handle
//
// Desktop sign-in through the browser (migration 930). The app keeps a random
// nonce and opens the site at /?desktop-signin=<state>, state =
// base64url(sha256(nonce)). Signed in there, the page files a one-time login
// under the state (desktop-handoff) and opens remappr://auth/handoff. The app
// claims it with its nonce (desktop-handoff-claim), on that link or by
// checking every few seconds, and signs in. Only the nonce claims anything,
// and it never leaves the app.
import { getCloudClient, type CloudClient } from './client'
import { authSiteUrl } from './authRedirect'
import { functionErrorCode } from './errors'

export const DESKTOP_SIGNIN_PARAM = 'desktop-signin'
const STATE_KEY = 'remappr.desktopSignin'
const DONE_KEY = 'remappr.desktopSigninDone'
const STATE_RE = /^[A-Za-z0-9_-]{43}$/
const POLL_MS = 2000
const GIVE_UP_MS = 10 * 60 * 1000

function b64url(bytes: Uint8Array): string {
    let text = ''
    for (const b of bytes) text += String.fromCharCode(b)
    return btoa(text).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** base64url(sha256(nonce)), as desktop-handoff-claim computes it. */
export async function stateOf(nonce: string): Promise<string> {
    const digest = await crypto.subtle.digest(
        'SHA-256',
        new TextEncoder().encode(nonce),
    )
    return b64url(new Uint8Array(digest))
}

export async function newHandoff(): Promise<{ nonce: string; state: string }> {
    const nonce = b64url(crypto.getRandomValues(new Uint8Array(32)))
    return { nonce, state: await stateOf(nonce) }
}

export function isHandoffState(value: unknown): value is string {
    return typeof value === 'string' && STATE_RE.test(value)
}

/** The page the desktop app opens in the browser. */
export function desktopSignInUrl(state: string): string {
    return `${authSiteUrl()}/?${DESKTOP_SIGNIN_PARAM}=${state}`
}

async function requireClient(): Promise<CloudClient> {
    const client = await getCloudClient()
    if (!client) throw new Error('Accounts are not available in this build')
    return client
}

// ── Browser side ─────────────────────────────────────────────────────────────

/** The state this page was opened with, kept for the tab's session so an
 *  OAuth round trip (which returns without the query) still finds it. The
 *  query leaves the address bar. */
export function desktopSignInState(): string | null {
    try {
        const url = new URL(window.location.href)
        const fromUrl = url.searchParams.get(DESKTOP_SIGNIN_PARAM)
        if (isHandoffState(fromUrl)) {
            sessionStorage.setItem(STATE_KEY, fromUrl)
            url.searchParams.delete(DESKTOP_SIGNIN_PARAM)
            window.history.replaceState(window.history.state, '', url.href)
            return fromUrl
        }
        const kept = sessionStorage.getItem(STATE_KEY)
        return isHandoffState(kept) ? kept : null
    } catch {
        // Storage blocked: only a state in the URL counts.
        return null
    }
}

/** The login went to the app: forget the state (a reload must not reopen
 *  the dialog) but remember, for this tab, that it was a sign-in tab. */
export function forgetDesktopSignInState(): void {
    try {
        sessionStorage.removeItem(STATE_KEY)
        sessionStorage.setItem(DONE_KEY, '1')
    } catch {
        // Storage blocked: nothing was kept.
    }
}

/** Whether this tab is (or was) signing the desktop app in. Read-only: the
 *  sync prompt and the like stay away from such a tab. */
export function isDesktopSignInTab(): boolean {
    try {
        if (
            new URL(window.location.href).searchParams.has(DESKTOP_SIGNIN_PARAM)
        )
            return true
        return !!(
            sessionStorage.getItem(STATE_KEY) ||
            sessionStorage.getItem(DONE_KEY)
        )
    } catch {
        return false
    }
}

/** File a one-time login for the signed-in user under the app's state. */
export async function fileHandoff(state: string): Promise<void> {
    const client = await requireClient()
    const { error } = await client.functions.invoke('desktop-handoff', {
        body: { state },
    })
    if (error) throw new Error(await functionErrorCode(error))
}

// ── Desktop side ─────────────────────────────────────────────────────────────

/** Take the login filed under the nonce's state and sign in with it; false
 *  while the browser has not filed it yet. */
export async function claimHandoff(nonce: string): Promise<boolean> {
    const client = await requireClient()
    const { data, error } = await client.functions.invoke<{
        tokenHash?: string
        pending?: boolean
    }>('desktop-handoff-claim', { body: { nonce } })
    if (error) throw new Error(await functionErrorCode(error))
    if (!data?.tokenHash) return false
    const { error: signInError } = await client.auth.verifyOtp({
        token_hash: data.tokenHash,
        type: 'email',
    })
    if (signInError) throw signInError
    return true
}

export interface DesktopSignIn {
    state: string
    /** Claim now (the remappr://auth/handoff link arrived for this state). */
    nudge(): void
    cancel(): void
}

/** Start a browser sign-in: opens the site, then claims until it succeeds,
 *  fails, times out (10 minutes) or is cancelled. */
export async function startDesktopSignIn(handlers: {
    onDone: () => void
    onError: (error: unknown) => void
}): Promise<DesktopSignIn> {
    const { nonce, state } = await newHandoff()
    let stopped = false
    let timer: ReturnType<typeof setTimeout> | undefined
    const started = Date.now()

    const stop = (): void => {
        stopped = true
        if (timer) clearTimeout(timer)
    }
    const attempt = async (): Promise<void> => {
        if (stopped) return
        try {
            if (await claimHandoff(nonce)) {
                stop()
                handlers.onDone()
                return
            }
        } catch (e) {
            if (stopped) return
            stop()
            handlers.onError(e)
            return
        }
        // A nudge's attempt may have finished meanwhile.
        if (stopped) return
        if (Date.now() - started > GIVE_UP_MS) {
            stop()
            handlers.onError(new Error('Sign-in timed out. Try again.'))
            return
        }
        timer = setTimeout(() => void attempt(), POLL_MS)
    }

    // main forwards https window.open targets to the system browser.
    window.open(desktopSignInUrl(state), '_blank')
    timer = setTimeout(() => void attempt(), POLL_MS)
    return {
        state,
        nudge: () => {
            if (stopped) return
            if (timer) clearTimeout(timer)
            void attempt()
        },
        cancel: stop,
    }
}
