// pattern-check: skip — single Electron IPC handler proxying one HTTP GET;
// procedural glue, no abstraction.
//
// Main-process proxy for GitHub Actions artifact downloads. The renderer cannot
// fetch the artifact zip directly: api.github.com 302-redirects to a signed
// Azure blob URL that sends no CORS headers for the app origin, so a renderer
// `fetch` throws. Node's fetch has no CORS, so we do it here. Security: the token
// is read from the OS-encrypted secret store (never passed in from the renderer),
// and only `https://api.github.com` URLs are honored so this can't be turned into an
// arbitrary-URL token-attaching SSRF gadget. Node's fetch follows the redirect
// and strips Authorization on the cross-origin hop, so the token never reaches
// the blob host.
import { ipcMain } from 'electron'
import { IpcChannels } from '../shared/ipc-types'
import { createLogger } from '../shared/logger'
import { getStoredSecret } from './secret-store'

const log = createLogger('github-artifact')

// Must match the renderer's secretStore GITHUB_TOKEN_KEY.
const GITHUB_TOKEN_KEY = 'githubToken'

function urlOf(arg: unknown): string | null {
    const u = (arg as { url?: unknown })?.url
    return typeof u === 'string' && u ? u : null
}

/** True only for an `https://api.github.com/…` URL: the one place the bearer
 *  token may be sent. A plain `http://` URL to the same host is refused, or the
 *  token would cross the network in cleartext. */
export function isAllowedArtifactUrl(url: string): boolean {
    let parsed: URL
    try {
        parsed = new URL(url)
    } catch {
        return false
    }
    return parsed.protocol === 'https:' && parsed.host === 'api.github.com'
}

/** Register the github:download-artifact IPC handler. Call once at startup. */
export function registerGithubArtifactHandler(): void {
    ipcMain.handle(
        IpcChannels.GITHUB_DOWNLOAD_ARTIFACT,
        async (_e, arg: unknown): Promise<Uint8Array | null> => {
            const url = urlOf(arg)
            if (!url) return null
            // Only proxy https GitHub API URLs — never attach the token
            // elsewhere, and never over cleartext.
            if (!isAllowedArtifactUrl(url)) {
                log.error('refused artifact url (not https://api.github.com)')
                return null
            }
            const token = getStoredSecret(GITHUB_TOKEN_KEY)
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
