// pattern-check: skip — thin async secret accessor choosing the Electron
// safeStorage IPC backend or the web's localStorage; glue, no abstraction.
//
// Renderer-side secret access. In Electron it routes to the main process's
// safeStorage-backed store (OS-encrypted, on disk) via the IPC bridge. On the
// web there is no OS keychain, so localStorage is the store (documented web
// behavior).
//
// Under Electron this fails CLOSED: when the encrypted store refuses a write
// (safeStorage unavailable — e.g. Linux with no keyring — or the bridge
// errors), setSecret rejects with SecretStorageUnavailableError instead of
// quietly writing the secret in plaintext to localStorage. Callers surface it.
// A plaintext value an older build left behind is still read, and moved into
// the encrypted store as soon as that store accepts it.
import { IpcChannels } from '@shared/ipc-types'

/** localStorage key prefix for the web store (and legacy desktop fallback). */
const PREFIX = 'remappr.secret.'

/** The GitHub cloud-build personal access token. */
export const GITHUB_TOKEN_KEY = 'githubToken'

/** The desktop app could not store a secret encrypted, and refused to store it
 *  in plaintext. The secret was NOT persisted. */
export class SecretStorageUnavailableError extends Error {
    constructor(readonly key: string) {
        super(
            'Secure storage is unavailable on this system (no OS keyring), so the secret was not saved.',
        )
        this.name = 'SecretStorageUnavailableError'
    }
}

interface IpcBridge {
    invoke(channel: string, ...args: unknown[]): Promise<unknown>
}

/** The Electron IPC bridge if running under Electron with it exposed. */
function bridge(): IpcBridge | null {
    const api = (globalThis as { api?: IpcBridge }).api
    return api && typeof api.invoke === 'function' ? api : null
}

function readLocal(key: string): string {
    try {
        return localStorage.getItem(PREFIX + key) ?? ''
    } catch {
        return ''
    }
}

function removeLocal(key: string): void {
    try {
        localStorage.removeItem(PREFIX + key)
    } catch {
        /* storage unavailable — nothing to remove */
    }
}

/** Ask the encrypted store to take `value`. True only on a confirmed write. */
async function encryptedSet(
    api: IpcBridge,
    key: string,
    value: string,
): Promise<boolean> {
    try {
        return (
            (await api.invoke(IpcChannels.SECRET_SET, { key, value })) === true
        )
    } catch {
        return false
    }
}

/** Move a legacy plaintext value into the encrypted store, if it accepts it. */
async function migrateLegacy(
    api: IpcBridge,
    key: string,
    value: string,
): Promise<void> {
    if (await encryptedSet(api, key, value)) removeLocal(key)
}

export async function getSecret(key: string): Promise<string> {
    const api = bridge()
    if (!api) return readLocal(key)
    try {
        const v = await api.invoke(IpcChannels.SECRET_GET, { key })
        if (typeof v === 'string') return v
    } catch {
        /* treat as not stored; the legacy read below still runs */
    }
    // null = not stored (or encryption unavailable). An older build may have
    // left a plaintext fallback: still honor it, and encrypt it when possible.
    const legacy = readLocal(key)
    if (legacy) await migrateLegacy(api, key, legacy)
    return legacy
}

export async function setSecret(key: string, value: string): Promise<void> {
    const api = bridge()
    if (!api) {
        writeLocal(key, value)
        return
    }
    if (!value) {
        // Deleting never needs encryption; also drop any legacy plaintext copy.
        try {
            await api.invoke(IpcChannels.SECRET_DELETE, { key })
        } finally {
            removeLocal(key)
        }
        return
    }
    if (!(await encryptedSet(api, key, value))) {
        throw new SecretStorageUnavailableError(key)
    }
    // Encrypted store owns it now — clear any stale plaintext copy.
    removeLocal(key)
}

function writeLocal(key: string, value: string): void {
    try {
        if (value) localStorage.setItem(PREFIX + key, value)
        else localStorage.removeItem(PREFIX + key)
    } catch {
        /* storage unavailable — non-fatal on the web */
    }
}
