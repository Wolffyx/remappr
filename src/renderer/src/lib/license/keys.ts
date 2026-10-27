// pattern-check: skip — pinned public keys (data), one lookup.
//
// Public keys the app trusts for builder licenses, by key id, one set per
// environment: a build trusts only the set for its __REMAPPR_ENV__ (a
// production build never accepts a staging license). Production's are pinned
// here; staging's come from the build env (DEV_SIGNING_PUBLIC_KEYS, see
// scripts/backend-env.ts), so they are not in the code. Rotation: ship the new
// key here in a release first, then switch the server's signing kid, and keep
// the old one (lifetime licenses offline stay signed with it). The dev key's
// private half exists only in a developer's gitignored supabase/functions/.env,
// so it is trusted in dev builds and local-backend builds only.

const PRODUCTION_KEYS: Readonly<Record<string, string>> = {
    'lic-production-1':
        '073cabf601aef60e26c6067aed2bfe1e9071bcc9096eab839bc559e5ecf98a2b',
}

const TRUSTED: Readonly<Record<string, Readonly<Record<string, string>>>> = {
    production: PRODUCTION_KEYS,
    staging: __REMAPPR_EXTRA_KEYS__.license,
}

const DEV_KEYS: Readonly<Record<string, string>> = {
    'lic-dev-1':
        '1eeb6ed805a21fc33def7bbebaa2618b82bdfe61d8fb56ca6813bf1910c5b9f5',
}

/** map[key] when it is the map's own entry (a kid comes from the token, so
 *  "constructor" and the like must not reach the prototype). */
function own<T>(map: Readonly<Record<string, T>>, key: string): T | null {
    return Object.hasOwn(map, key) ? map[key] : null
}

/** The Ed25519 public key (hex) for a license key id, or null when untrusted. */
export function licensePublicKey(
    kid: string,
    env: Pick<ImportMetaEnv, 'DEV'> = import.meta.env,
    envName: string = __REMAPPR_ENV__,
): string | null {
    const hosted = own(TRUSTED, envName)
    const key = hosted ? own(hosted, kid) : null
    if (key) return key
    return env.DEV || envName === 'local' ? own(DEV_KEYS, kid) : null
}
