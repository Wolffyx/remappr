// Pattern check: Strategy (Tier 1) — extended — supplies a secret-store-backed
// concrete RemapprIdentityStore through the client's existing
// setRemapprIdentityStore injection seam (auth.ts declares the Strategy).
//
// Persists the §19 control-auth host identity (a 32-byte X25519 secret) so it
// survives app restarts. Without this the client's defaultStore falls back to an
// in-memory keypair — its localStorage probe is captured at module-eval, which is
// undefined in this bundle's eval context — and regenerates the identity every
// launch. A keyboard node that TOFU-bonded the first launch's key then rejects
// every later reconnect at the FINISH bond gate with ERR_AUTH.
//
// RemapprIdentityStore.load() is synchronous, but the durable backend
// (OS-encrypted secret-store over IPC, localStorage fallback) is async. So we
// preload the secret once, cache it, and expose a sync facade over the cache with
// async write-through. initRemapprIdentity() is awaited at the connect gate
// (ensureFirmwareClientsLoaded) so the cache is warm before loadOrCreateIdentity().
// Narrow import (auth module, not the '@firmware/remappr' barrel): the barrel
// registers the Remappr adapter as an import side effect, which would defeat
// firmwareClients' lazy chunking (this file loads with it) and pre-seed the
// adapter registry before ensureFirmwareClientsLoaded runs.
import { setRemapprIdentityStore } from '@firmware/remappr/auth'
import { getSecret, setSecret } from './secretStore'

/** Secret-store key for the persisted host identity (32-byte X25519 secret, hex). */
const IDENTITY_KEY = 'remappr.identity.v1'
/** 32-byte X25519 secret == 64 hex chars. */
const HEX_LEN = 64

const toHex = (u: Uint8Array): string =>
    Array.from(u, (b) => b.toString(16).padStart(2, '0')).join('')
const fromHex = (s: string): Uint8Array =>
    Uint8Array.from(s.match(/.{2}/g)?.map((h) => parseInt(h, 16)) ?? [])

let cached: Uint8Array | null = null
let initOnce: Promise<void> | null = null

/**
 * Load the persisted host identity from the OS secret-store into the cache and
 * inject a sync RemapprIdentityStore over it. Idempotent + memoized so every
 * connect path can await it cheaply. Must resolve before the first
 * loadOrCreateIdentity() — the connect gate awaits it. A missing/corrupt stored
 * value leaves the cache null, so loadOrCreateIdentity() mints a fresh identity
 * and save() persists it durably (matching the same key on the next launch).
 */
export function initRemapprIdentity(): Promise<void> {
    if (initOnce) return initOnce
    initOnce = (async () => {
        try {
            const hex = await getSecret(IDENTITY_KEY)
            if (hex.length === HEX_LEN) cached = fromHex(hex)
        } catch {
            /* no stored identity yet — loadOrCreateIdentity() will mint one */
        }
        setRemapprIdentityStore({
            load: () => cached,
            save: (priv) => {
                cached = priv
                void setSecret(IDENTITY_KEY, toHex(priv))
            },
        })
    })()
    return initOnce
}
