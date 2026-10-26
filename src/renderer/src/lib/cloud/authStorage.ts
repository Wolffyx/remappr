// Pattern check: Adapter (Tier 1) — applied — auth-js's storage interface over
// the app's async secret store (lib/secretStore.ts).
//
// Supabase auth keeps the session + PKCE verifier in a key-value store. Under
// Electron that store is the OS-encrypted secretStore (safeStorage over IPC); on
// the web secretStore falls back to localStorage. auth-js reads the session on
// every request, so a write-through cache keeps those reads off the IPC bridge.
import { getSecret, setSecret } from '@/lib/secretStore'

/** The subset of auth-js `SupportedStorage` this adapter implements. */
export interface AuthStorage {
    getItem(key: string): Promise<string | null>
    setItem(key: string, value: string): Promise<void>
    removeItem(key: string): Promise<void>
}

export interface SecretBackend {
    get(key: string): Promise<string>
    set(key: string, value: string): Promise<void>
}

const secretBackend: SecretBackend = { get: getSecret, set: setSecret }

/** auth-js storage over `backend`. `''` means "not stored", so it maps to null
 *  and a remove writes `''`. */
export function createAuthStorage(
    backend: SecretBackend = secretBackend,
): AuthStorage {
    const cache = new Map<string, string | null>()
    return {
        async getItem(key) {
            if (cache.has(key)) return cache.get(key) ?? null
            const value = (await backend.get(key)) || null
            cache.set(key, value)
            return value
        },
        async setItem(key, value) {
            cache.set(key, value)
            await backend.set(key, value)
        },
        async removeItem(key) {
            cache.set(key, null)
            await backend.set(key, '')
        },
    }
}
