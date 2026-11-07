// pattern-check: skip — single Electron IPC handler proxying one HTTP GET;
// procedural glue, no abstraction.
//
// Main-process proxy for GitHub Actions artifact downloads. The renderer cannot
// fetch the artifact zip directly: api.github.com 302-redirects to a signed
// Azure blob URL that sends no CORS headers for the app origin, so a renderer
// `fetch` throws. Node's fetch has no CORS, so we do it here. Security: the token
// is read from the OS-encrypted secret store (never passed in from the renderer),
// and only `api.github.com` URLs are honored so this can't be turned into an
// arbitrary-URL token-attaching SSRF gadget. Node's fetch follows the redirect
// and strips Authorization on the cross-origin hop, so the token never reaches
// the blob host.
import { ipcMain } from 'electron'
import { IpcChannels } from '../shared/ipc-types'
import { createLogger } from '../shared/logger'
import { getStoredSecret } from './secret-store'

const log = createLogger('github-artifact')

// Must match the renderer's secretStore GITHUB_TOKEN_KEY and the GitHub App
// connection key in lib/github/connection.ts.
const GITHUB_TOKEN_KEY = 'githubToken'
const GITHUB_APP_KEY = 'githubApp'
// A token this close to running out is not used (the renderer refreshes it).
const EXPIRY_MARGIN_MS = 30_000

/** The GitHub App's user token while it is valid, else the personal access
 *  token (Connect GitHub stores the former, the advanced fallback the latter). */
export function githubToken(
    read: (key: string) => string | null = getStoredSecret,
    now: number = Date.now(),
): string | null {
    const raw = read(GITHUB_APP_KEY)
    if (raw) {
        try {
            const app = JSON.parse(raw) as {
                accessToken?: unknown
                expiresAt?: unknown
            }
            const fresh =
                typeof app.expiresAt !== 'number' ||
                app.expiresAt - EXPIRY_MARGIN_MS > now
            if (typeof app.accessToken === 'string' && app.accessToken && fresh)
                return app.accessToken
        } catch {
            log.warn('stored GitHub App connection is unreadable')
        }
    }
    return read(GITHUB_TOKEN_KEY) || null
}

function urlOf(arg: unknown): string | null {
    const u = (arg as { url?: unknown })?.url
    return typeof u === 'string' && u ? u : null
}

/** Register the github:download-artifact IPC handler. Call once at startup. */
export function registerGithubArtifactHandler(): void {
    ipcMain.handle(
        IpcChannels.GITHUB_DOWNLOAD_ARTIFACT,
        async (_e, arg: unknown): Promise<Uint8Array | null> => {
            const url = urlOf(arg)
            if (!url) return null
            // Only proxy GitHub API URLs — never attach the token elsewhere.
            let host: string
            try {
                host = new URL(url).host
            } catch {
                return null
            }
            if (host !== 'api.github.com') {
                log.error('refused non-GitHub artifact url', host)
                return null
            }
            const token = githubToken()
            if (!token) {
                log.error('no stored GitHub token for artifact download')
                return null
            }
            try {
                const res = await fetch(url, {
                    headers: {
                        Authorization: `Bearer ${token}`,
                        Accept: 'application/vnd.github+json',
                        'X-GitHub-Api-Version': '2022-11-28',
                    },
                })
                if (!res.ok) {
                    log.error('artifact download failed', res.status)
                    return null
                }
                return new Uint8Array(await res.arrayBuffer())
            } catch (e) {
                log.error('artifact download error', e)
                return null
            }
        },
    )
}
