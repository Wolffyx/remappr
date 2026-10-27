// Pattern check: no GoF pattern (-) — rejected — a pure URL validator and a
// small pending-code queue in a closure; no abstraction beyond that.
//
// Sign-in on desktop: the system browser finishes OAuth on remappr.com's
// auth/desktop.html, which opens remappr://auth/callback?code=… . The OS hands
// that URL to this app: as argv on Windows/Linux (a second instance, or the cold
// start) and as `open-url` on macOS. Each code is validated, used once, and held
// until the renderer takes it, so a code that arrives before the window loads is
// not lost.
import { app, ipcMain, type BrowserWindow } from 'electron'
import { IpcChannels, IpcEvents } from '../shared/ipc-types'

export const PROTOCOL = 'remappr'

// Supabase PKCE auth codes are uuids; allow a little room, nothing else.
const CODE_RE = /^[A-Za-z0-9-]{16,128}$/

/** The auth code in a remappr://auth/callback?code=… URL, or null for any
 *  other URL. */
export function parseAuthCallback(raw: string): string | null {
    let u: URL
    try {
        u = new URL(raw)
    } catch {
        return null
    }
    if (u.protocol !== `${PROTOCOL}:`) return null
    if (u.hostname !== 'auth' || u.pathname !== '/callback') return null
    const code = u.searchParams.get('code')
    return code && CODE_RE.test(code) ? code : null
}

// A browser sign-in's state: base64url(sha256(nonce)), 43 characters.
const STATE_RE = /^[A-Za-z0-9_-]{43}$/

/** The state in a remappr://auth/handoff?state=… URL, or null. It claims
 *  nothing by itself: it only tells the app to collect its login now. */
export function parseHandoff(raw: string): string | null {
    let u: URL
    try {
        u = new URL(raw)
    } catch {
        return null
    }
    if (u.protocol !== `${PROTOCOL}:`) return null
    if (u.hostname !== 'auth' || u.pathname !== '/handoff') return null
    const state = u.searchParams.get('state')
    return state && STATE_RE.test(state) ? state : null
}

/** The first remappr:// URL in a process argv, if any. */
export function deepLinkFromArgv(argv: readonly string[]): string | null {
    return argv.find((a) => a.startsWith(`${PROTOCOL}://`)) ?? null
}

export interface AuthCallbackQueue {
    /** Accept a deep link; returns whether it carried a new, valid code. */
    accept(url: string): boolean
    /** The code waiting for the renderer, cleared on read. */
    take(): string | null
}

export function createAuthCallbackQueue(
    deliver: (code: string) => void,
): AuthCallbackQueue {
    const seen = new Set<string>()
    let pending: string | null = null
    return {
        accept(url) {
            const code = parseAuthCallback(url)
            if (!code || seen.has(code)) return false
            seen.add(code)
            pending = code
            deliver(code)
            return true
        },
        take() {
            const code = pending
            pending = null
            return code
        },
    }
}

/** Register remappr:// with the OS and route its URLs to the renderer. Call
 *  before `whenReady`, after the single-instance lock is held. */
export function setupDeepLinks(getWindow: () => BrowserWindow | null): void {
    // An unpackaged dev run must pass its entry script so the OS relaunches it.
    if (process.defaultApp && process.argv[1]) {
        app.setAsDefaultProtocolClient(PROTOCOL, process.execPath, [
            process.argv[1],
        ])
    } else {
        app.setAsDefaultProtocolClient(PROTOCOL)
    }

    const queue = createAuthCallbackQueue((code) => {
        // Pushed when a window is up; take() covers one that has not loaded yet.
        getWindow()?.webContents.send(IpcEvents.AUTH_CALLBACK, { code })
    })
    const focus = (): void => {
        const win = getWindow()
        if (!win) return
        if (win.isMinimized()) win.restore()
        win.focus()
    }

    ipcMain.handle(IpcChannels.AUTH_TAKE_CALLBACK, () => queue.take())

    // A handoff link only nudges a running sign-in; on a cold start the
    // sign-in is not running, and the app's own checks cover the rest.
    const route = (url: string): void => {
        const state = parseHandoff(url)
        if (state)
            getWindow()?.webContents.send(IpcEvents.AUTH_HANDOFF, { state })
        else queue.accept(url)
    }

    app.on('second-instance', (_e, argv) => {
        const url = deepLinkFromArgv(argv)
        if (url) route(url)
        focus()
    })
    app.on('will-finish-launching', () => {
        app.on('open-url', (event, url) => {
            event.preventDefault()
            route(url)
            focus()
        })
    })
    const cold = deepLinkFromArgv(process.argv)
    if (cold) route(cold)
}
