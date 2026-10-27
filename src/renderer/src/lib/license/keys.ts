// pattern-check: skip — pinned public keys (data), one lookup.
//
// Public keys the app trusts for builder licenses, by key id. Rotation: ship
// the new key here in a release first, then switch the server's signing kid.
// The dev key's private half exists only in a developer's gitignored
// supabase/functions/.env, so it is trusted in dev builds only.

const PRODUCTION_KEYS: Readonly<Record<string, string>> = {
    'lic-production-1':
        '164631f8580ecfc37c19923d9fcf1c3d11a8c8e24e9bf8a05f509e52411d55c9',
}

const DEV_KEYS: Readonly<Record<string, string>> = {
    'lic-dev-1':
        '1eeb6ed805a21fc33def7bbebaa2618b82bdfe61d8fb56ca6813bf1910c5b9f5',
}

/** The Ed25519 public key (hex) for a license key id, or null when untrusted. */
export function licensePublicKey(
    kid: string,
    env: Pick<ImportMetaEnv, 'DEV'> = import.meta.env,
): string | null {
    return PRODUCTION_KEYS[kid] ?? (env.DEV ? (DEV_KEYS[kid] ?? null) : null)
}
