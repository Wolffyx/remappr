// pattern-check: skip — pinned public keys (data) and pure verification of a
// signed builder package, shared by the Electron main process and the renderer.
//
// get-package returns the builder with a manifest signed by PACKAGE_SIGNING_KEY
// (Ed25519). Hosts trust a signature only from these pinned keys, and every
// file's sha256 must match the signed manifest before it is served or loaded.
// One key set per environment: a build trusts only the set for its
// __REMAPPR_ENV__. Production's are pinned here; staging's come from the
// build env (scripts/backend-env.ts), so they are not in the code. The dev key's private half lives only in a developer's
// gitignored supabase/functions/.env, so it is trusted in dev builds and
// local-backend builds only.
import { ed25519 } from '@noble/curves/ed25519.js'

const PRODUCTION_PACKAGE_KEYS: Readonly<Record<string, string>> = {
    'pkg-production-1':
        '2a2c0bccaa0794b92bffebad91d783793caffe975b34b7b9c1fd18c036192039',
}

const TRUSTED_PACKAGE_KEYS: Readonly<
    Record<string, Readonly<Record<string, string>>>
> = {
    production: PRODUCTION_PACKAGE_KEYS,
    staging: __REMAPPR_EXTRA_KEYS__.package,
}

const DEV_PACKAGE_KEYS: Readonly<Record<string, string>> = {
    'pkg-dev-1':
        'e7b77f3051d7cf988dc218393056a50ca137ce4bf555ff54292114f77b7af1a6',
}

/** map[key] when it is the map's own entry (a kid comes from the manifest,
 *  so "constructor" and the like must not reach the prototype). */
function own<T>(map: Readonly<Record<string, T>>, key: string): T | null {
    return Object.hasOwn(map, key) ? map[key] : null
}

/** The Ed25519 public key (hex) for a package key id, or null when untrusted. */
export function packagePublicKey(
    kid: string,
    dev: boolean,
    envName: string = __REMAPPR_ENV__,
): string | null {
    const hosted = own(TRUSTED_PACKAGE_KEYS, envName)
    const key = hosted ? own(hosted, kid) : null
    if (key) return key
    return dev || envName === 'local' ? own(DEV_PACKAGE_KEYS, kid) : null
}

export interface SignedPackageFile {
    path: string
    sha256: string
    bytes: number
}

export interface SignedManifest {
    name: string
    version: string
    hostApi: string
    hostModules: string[]
    files: SignedPackageFile[]
    /** "free" or the per-user watermark. */
    licensee: string
    issuedAt: number
}

/** What a host stores next to the files: the exact signed text and its signature. */
export interface PackageSignature {
    manifest: string
    /** base64 */
    signature: string
    kid: string
}

const FILE_RE = /^[A-Za-z0-9._-]+$/
const VERSION_RE = /^\d+\.\d+\.\d+$/

function fromBase64(text: string): Uint8Array {
    const b = atob(text)
    return Uint8Array.from(b, (c) => c.charCodeAt(0))
}

function hexToBytes(hex: string): Uint8Array {
    return Uint8Array.from((hex.match(/../g) ?? []).map((h) => parseInt(h, 16)))
}

/** The manifest when the signature holds under a pinned key and its version
 *  and file names are safe to use as paths; null otherwise. */
export function verifySignedManifest(
    signed: PackageSignature,
    dev: boolean,
): SignedManifest | null {
    const key = packagePublicKey(signed.kid, dev)
    if (!key) return null
    try {
        const ok = ed25519.verify(
            fromBase64(signed.signature),
            new TextEncoder().encode(signed.manifest),
            hexToBytes(key),
        )
        if (!ok) return null
        const manifest = JSON.parse(signed.manifest) as SignedManifest
        if (!VERSION_RE.test(manifest.version)) return null
        if (!manifest.files.every((f) => FILE_RE.test(f.path))) return null
        return manifest
    } catch {
        // A malformed signature, key or manifest never verifies.
        return null
    }
}

export async function sha256Hex(
    bytes: Uint8Array | ArrayBuffer,
): Promise<string> {
    const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
    const d = new Uint8Array(
        await crypto.subtle.digest('SHA-256', view as Uint8Array<ArrayBuffer>),
    )
    return [...d].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** Whether a file matches its signed manifest entry. */
export async function fileMatches(
    entry: SignedPackageFile,
    bytes: Uint8Array | ArrayBuffer,
): Promise<boolean> {
    const length = bytes instanceof Uint8Array ? bytes.length : bytes.byteLength
    return length === entry.bytes && (await sha256Hex(bytes)) === entry.sha256
}

/** Compare "1.2.10" > "1.2.9". */
export function compareVersions(a: string, b: string): number {
    const pa = a.split('.').map(Number)
    const pb = b.split('.').map(Number)
    for (let i = 0; i < 3; i++)
        if (pa[i] !== pb[i]) return (pa[i] ?? 0) - (pb[i] ?? 0)
    return 0
}

export { fromBase64 as decodeBase64 }
