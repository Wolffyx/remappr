// pattern-check: skip — pinned public keys (data), one lookup.
//
// Public keys the app trusts for builder licenses, by key id. Rotation: ship
// the new key here in a release first, then switch the server's signing kid.
// The dev key's private half exists only in a developer's gitignored
// supabase/functions/.env, so it is trusted in dev builds only.

const PRODUCTION_KEYS: Readonly<Record<string, string>> = {
    'lic-staging-1':
        '436efdfe19b82638e1affb948ea8694bed81368ff8f007b3964a2d5e11247bc4',
    'lic-production-1':
        '4eaa422d1f93162e320739e3b64d2d1bf0184c87adeb3af7199be81cee9d5a4d',
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
