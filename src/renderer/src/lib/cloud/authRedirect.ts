// pattern-check: skip — URL helpers for the OAuth round trip, no abstraction.
//
// Where OAuth returns to. The web app returns to itself and auth-js picks the
// code out of the URL. Desktop can't be redirected to (file:// has no origin),
// so the browser lands on the site's auth/desktop.html bounce page, which opens
// remappr://auth/callback and shows the code to paste as a fallback.

const AUTH_PARAMS = ['code', 'error', 'error_code', 'error_description']

/** This page's origin when it is served over http(s) (a dev server, or the
 *  web app); null under app:// or file://. */
function httpOrigin(): string | null {
    if (typeof window === 'undefined') return null
    const { protocol, origin } = window.location
    return protocol === 'http:' || protocol === 'https:' ? origin : null
}

/** The site the desktop app opens to sign in (and that hosts
 *  auth/desktop.html). In order: an explicit override from .env.local; in a
 *  dev run, this dev server itself (the same app, opened in the browser, on
 *  whatever port it got); the build's site for its backend; remappr.com. */
export function authSiteUrl(
    env: Pick<
        ImportMetaEnv,
        'VITE_AUTH_SITE_URL' | 'VITE_AUTH_SITE_OVERRIDE' | 'DEV'
    > = import.meta.env,
    origin: string | null = httpOrigin(),
): string {
    const trim = (url: string): string => url.trim().replace(/\/+$/, '')
    const override = env.VITE_AUTH_SITE_OVERRIDE?.trim()
    if (override) return trim(override)
    if (env.DEV && origin) return trim(origin)
    const configured = env.VITE_AUTH_SITE_URL?.trim()
    if (configured) return trim(configured)
    return env.DEV ? 'http://localhost:5173' : 'https://remappr.com'
}

export function oauthRedirectTo(electron: boolean): string {
    if (electron) return `${authSiteUrl()}/auth/desktop.html`
    return new URL(import.meta.env.BASE_URL, window.location.origin).href
}

/** Drop auth query params from the address bar once the session is set. */
export function stripAuthParams(): void {
    const url = new URL(window.location.href)
    if (!AUTH_PARAMS.some((p) => url.searchParams.has(p))) return
    for (const p of AUTH_PARAMS) url.searchParams.delete(p)
    window.history.replaceState(window.history.state, '', url.href)
}

/** The auth code inside whatever the user pasted: the bare code, or the whole
 *  remappr:// or bounce-page URL. */
export function codeFromPaste(text: string): string | null {
    const trimmed = text.trim()
    if (/^[A-Za-z0-9-]{16,128}$/.test(trimmed)) return trimmed
    try {
        const code = new URL(trimmed).searchParams.get('code')
        return code && /^[A-Za-z0-9-]{16,128}$/.test(code) ? code : null
    } catch {
        return null
    }
}
