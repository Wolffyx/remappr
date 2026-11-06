// pattern-check: skip — one memoized fetch of the auth server's public
// settings plus a pure filter.
//
// Which OAuth providers the backend actually has turned on. Auth publishes it
// at /auth/v1/settings ("external": { github: true, … }), so the sign-in and
// Sign-in methods screens only offer providers that work on this server.
import { cloudConfig } from './env'
import { AUTH_PROVIDERS, type AuthProvider } from './identities'

/** The providers a settings reply marks as on, in AUTH_PROVIDERS order. */
export function providersFromSettings(settings: unknown): AuthProvider[] {
    const external = (settings as { external?: Record<string, unknown> })
        ?.external
    if (!external) return []
    return AUTH_PROVIDERS.map((p) => p.id).filter((id) => external[id] === true)
}

let asked: Promise<AuthProvider[]> | null = null

/** The providers this build's backend has on; none without a backend. A
 *  failed read is retried on the next call. */
export function enabledProviders(): Promise<AuthProvider[]> {
    const config = cloudConfig()
    if (!config) return Promise.resolve([])
    asked ??= fetch(`${config.url}/auth/v1/settings`, {
        headers: { apikey: config.publishableKey },
    })
        .then((res) => {
            if (!res.ok) throw new Error(`auth settings: ${res.status}`)
            return res.json()
        })
        .then(providersFromSettings)
        .catch((e: unknown) => {
            asked = null
            throw e
        })
    return asked
}
