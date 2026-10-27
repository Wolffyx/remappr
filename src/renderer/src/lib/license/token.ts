// pattern-check: skip — pure offline verification of a license token; ordered
// guard clauses, each returning why a token does not hold.
//
// A builder license is base64url(claims JSON) "." base64url(Ed25519 signature),
// signed by the license-activate / license-refresh Edge Functions. Offline
// checks, in order: the key is pinned, the signature holds, it names this
// device (and, on desktop, this machine), it carries a lease of at most 31
// days that has not run out, and the clock was not turned back to stretch it.
// The app renews the lease online (license-refresh checks the database), so a
// token the server did not issue stops working within a month.
import { ed25519 } from '@noble/curves/ed25519.js'

export interface LicenseClaims {
    v: 1
    kid: string
    sub: string
    dev: string
    mach: string | null
    feat: { builder?: number }
    plan: 'lifetime' | 'subscription' | 'grant'
    iat: number
    /** Seconds since the epoch: the end of this token's lease. Older tokens
     *  without one (null) are no longer accepted. */
    exp: number | null
}

export type LicenseProblem =
    | 'malformed'
    | 'untrusted_key'
    | 'bad_signature'
    | 'other_device'
    | 'other_machine'
    | 'expired'
    | 'no_lease'
    | 'clock_rollback'

export type LicenseVerdict =
    | { ok: true; claims: LicenseClaims }
    | { ok: false; problem: LicenseProblem }

export interface VerifyContext {
    /** sha256(SPKI) of this device's key. */
    device: string
    /** Desktop machine hash; null on the web (not checked). */
    machine: string | null
    /** ms since the epoch. */
    now: number
    /** The latest time this app has seen (ms), for the rollback guard. */
    maxSeen: number
    publicKey: (kid: string) => string | null
}

/** The longest lease a token may carry (the server issues 30 days). A token
 *  with none, or a longer one, was not issued by our server as it is now. */
export const LEASE_MAX_S = 31 * 24 * 60 * 60

/** A clock more than this far behind the latest time seen is a rollback. */
export const ROLLBACK_TOLERANCE_MS = 24 * 60 * 60 * 1000

function fromB64url(text: string): Uint8Array {
    const b = atob(text.replace(/-/g, '+').replace(/_/g, '/'))
    return Uint8Array.from(b, (c) => c.charCodeAt(0))
}

function hexToBytes(hex: string): Uint8Array {
    return Uint8Array.from((hex.match(/../g) ?? []).map((h) => parseInt(h, 16)))
}

/** The claims without checking anything (for display); null when malformed. */
export function readClaims(token: string): LicenseClaims | null {
    try {
        const [body] = token.split('.')
        return JSON.parse(
            new TextDecoder().decode(fromB64url(body)),
        ) as LicenseClaims
    } catch {
        // Not a token: callers treat null as "no license".
        return null
    }
}

function signatureHolds(token: string, publicKeyHex: string): boolean {
    const [body, sig] = token.split('.')
    try {
        return ed25519.verify(
            fromB64url(sig),
            fromB64url(body),
            hexToBytes(publicKeyHex),
        )
    } catch {
        // A malformed signature or key never verifies.
        return false
    }
}

export function verifyLicense(
    token: string,
    ctx: VerifyContext,
): LicenseVerdict {
    const claims = readClaims(token)
    if (!claims || claims.v !== 1 || !token.includes('.'))
        return { ok: false, problem: 'malformed' }
    const key = ctx.publicKey(claims.kid)
    if (!key) return { ok: false, problem: 'untrusted_key' }
    if (!signatureHolds(token, key))
        return { ok: false, problem: 'bad_signature' }
    if (claims.dev !== ctx.device) return { ok: false, problem: 'other_device' }
    if (claims.mach && ctx.machine !== null && claims.mach !== ctx.machine)
        return { ok: false, problem: 'other_machine' }
    if (claims.exp === null || claims.exp - claims.iat > LEASE_MAX_S)
        return { ok: false, problem: 'no_lease' }
    if (claims.exp * 1000 <= ctx.now) return { ok: false, problem: 'expired' }
    if (ctx.now < ctx.maxSeen - ROLLBACK_TOLERANCE_MS)
        return { ok: false, problem: 'clock_rollback' }
    return { ok: true, claims }
}
