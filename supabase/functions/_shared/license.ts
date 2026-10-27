// pattern-check: skip — small pure helpers shared by the license functions.
//
// License tokens: base64url(JSON claims) "." base64url(Ed25519 signature over
// the claims bytes). The app verifies them offline against pinned public keys
// (src/renderer/src/lib/license/keys.ts); only these functions hold the
// private key (LICENSE_SIGNING_KEY, Supabase secret).
import { ed25519 } from 'npm:@noble/curves@2.2.0/ed25519.js'
import {
    createClient,
    type SupabaseClient,
} from 'npm:@supabase/supabase-js@2.118.0'

export interface LicenseClaims {
    v: 1
    kid: string
    sub: string
    dev: string
    mach: string | null
    feat: { builder: 1 }
    plan: 'lifetime' | 'subscription' | 'grant'
    iat: number
    exp: number | null
}

export interface LicenseState {
    device_active: boolean
    entitled: boolean
    lifetime: boolean
    grant: boolean
    expires_at: string | null
}

const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers':
        'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

export function json(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { ...CORS, 'Content-Type': 'application/json' },
    })
}

/** Answer CORS preflight; null for a real request. */
export function preflight(req: Request): Response | null {
    return req.method === 'OPTIONS'
        ? new Response('ok', { headers: CORS })
        : null
}

const enc = new TextEncoder()

export function b64url(bytes: Uint8Array): string {
    let s = ''
    for (const b of bytes) s += String.fromCharCode(b)
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function fromB64url(text: string): Uint8Array {
    const b = atob(text.replace(/-/g, '+').replace(/_/g, '/'))
    return Uint8Array.from(b, (c) => c.charCodeAt(0))
}

function hexToBytes(hex: string): Uint8Array {
    return Uint8Array.from(hex.match(/../g)!.map((h) => parseInt(h, 16)))
}

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
    const d = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))
    return [...d].map((b) => b.toString(16).padStart(2, '0')).join('')
}

function signingKey(): { key: Uint8Array; kid: string } {
    const hex = Deno.env.get('LICENSE_SIGNING_KEY')
    const kid = Deno.env.get('LICENSE_SIGNING_KID')
    if (!hex || !kid) throw new Error('license signing key is not configured')
    return { key: hexToBytes(hex), kid }
}

export function signLicense(claims: Omit<LicenseClaims, 'kid'>): string {
    const { key, kid } = signingKey()
    const body = enc.encode(JSON.stringify({ ...claims, kid }))
    return `${b64url(body)}.${b64url(ed25519.sign(body, key))}`
}

/** The claims of a token this server signed, or null when it does not verify. */
export function readOwnLicense(token: string): LicenseClaims | null {
    const [body, sig] = token.split('.')
    if (!body || !sig) return null
    const { key } = signingKey()
    try {
        const bytes = fromB64url(body)
        if (!ed25519.verify(fromB64url(sig), bytes, ed25519.getPublicKey(key)))
            return null
        return JSON.parse(new TextDecoder().decode(bytes)) as LicenseClaims
    } catch {
        // Not base64 / not JSON: not a token we signed.
        return null
    }
}

/** Proof that the caller holds the device's private key: an ECDSA P-256
 *  signature (raw r||s, as WebCrypto makes it) over `uid.dev.ts`. */
export async function verifyDeviceProof(
    spki: Uint8Array,
    message: string,
    signature: Uint8Array,
): Promise<boolean> {
    const key = await crypto.subtle.importKey(
        'spki',
        spki,
        { name: 'ECDSA', namedCurve: 'P-256' },
        false,
        ['verify'],
    )
    return crypto.subtle.verify(
        { name: 'ECDSA', hash: 'SHA-256' },
        key,
        signature,
        enc.encode(message),
    )
}

export function adminClient(): SupabaseClient {
    return createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
        {
            auth: { persistSession: false },
        },
    )
}

/** The signed-in caller's user id, from the request's bearer token. */
export async function callerId(req: Request): Promise<string | null> {
    const auth = req.headers.get('Authorization')
    if (!auth) return null
    const client = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_ANON_KEY')!,
        {
            global: { headers: { Authorization: auth } },
            auth: { persistSession: false },
        },
    )
    const { data } = await client.auth.getUser()
    return data.user?.id ?? null
}

export async function licenseState(
    admin: SupabaseClient,
    user: string,
    dev: string,
): Promise<LicenseState> {
    const { data, error } = await admin.rpc('license_state', {
        p_user: user,
        p_device: dev,
    })
    if (error) throw error
    return data as LicenseState
}

/** The claims for what the user holds now; exp from the latest valid_until. */
export function claimsFor(
    state: LicenseState,
    sub: string,
    dev: string,
    mach: string | null,
): Omit<LicenseClaims, 'kid'> {
    const plan = state.lifetime
        ? 'lifetime'
        : state.grant && !state.expires_at
          ? 'grant'
          : 'subscription'
    const forever = state.lifetime || (state.grant && !state.expires_at)
    return {
        v: 1,
        sub,
        dev,
        mach,
        feat: { builder: 1 },
        plan,
        iat: Math.floor(Date.now() / 1000),
        exp:
            forever || !state.expires_at
                ? null
                : Math.floor(new Date(state.expires_at).getTime() / 1000),
    }
}
