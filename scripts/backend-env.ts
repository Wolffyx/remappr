// Pattern check: Dispatch Map (Tier 0) — applied — backend name maps to its env keys and environment name
//
// Which Supabase backend a local build talks to. .env.local holds all three
// (LOCAL_, DEV_ and PROD_ SUPABASE_URL / SUPABASE_PUBLISHABLE_KEY) and
// REMAPPR_BACKEND picks one, dev by default. A one-off run overrides it:
//
//   REMAPPR_BACKEND=prod pnpm dev
//
// CI sets VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY / VITE_REMAPPR_ENV
// itself; those always win. The chosen values reach the app as the usual
// import.meta.env.VITE_SUPABASE_* (set before Vite reads the env), and the
// environment name as __REMAPPR_ENV__, which decides the trusted signing keys.
//
// Staging's public signing keys are not in the code: they come from
// DEV_SIGNING_PUBLIC_KEYS in .env.local (CI: VITE_SIGNING_PUBLIC_KEYS) as
// "kid:hex" pairs, and reach the app as __REMAPPR_EXTRA_KEYS__. Only staging
// builds take them; production trusts only the keys pinned in the code.
import { loadEnv } from 'vite'

export type Backend = 'local' | 'dev' | 'prod'

/** The signing-key set each backend's builds trust (see license/keys.ts). */
const ENV_NAME: Record<Backend, string> = {
    local: 'local',
    dev: 'staging',
    prod: 'production',
}

/** The site the desktop app opens to sign in (lib/cloud/desktopHandoff);
 *  <PREFIX>_AUTH_SITE_URL in .env.local overrides it, e.g. a local web dev
 *  server while testing a change to the sign-in page. */
const AUTH_SITE: Record<Backend, string> = {
    local: 'http://localhost:5173',
    dev: 'https://dev.remappr.com',
    prod: 'https://remappr.com',
}

export const DEFAULT_BACKEND: Backend = 'dev'

export interface BackendEnv {
    backend: Backend | 'ci'
    url: string
    publishableKey: string
    /** production | staging | local; '' trusts no hosted key. */
    envName: string
    /** "kid:hex,kid:hex" public signing keys for staging builds. */
    signingKeys: string
    /** Where desktop sign-in opens the browser. */
    authSiteUrl: string
}

export interface ExtraKeys {
    license: Record<string, string>
    package: Record<string, string>
}

const KEY_RE = /^(lic|pkg)-[a-z0-9-]{1,40}:[0-9a-f]{64}$/

/** Parse "lic-x-1:hex,pkg-x-1:hex" into license and package keys. A build
 *  for anything but staging trusts none of them. */
export function parseSigningKeys(text: string, envName: string): ExtraKeys {
    const keys: ExtraKeys = { license: {}, package: {} }
    if (envName !== 'staging') return keys
    for (const pair of text
        .split(',')
        .map((p) => p.trim())
        .filter(Boolean)) {
        if (!KEY_RE.test(pair))
            throw new Error(`signing public key "${pair}" is not kid:64-hex`)
        const [kid, hex] = pair.split(':')
        keys[kid.startsWith('lic-') ? 'license' : 'package'][kid] = hex
    }
    return keys
}

function isBackend(value: string | undefined): value is Backend {
    return value === 'local' || value === 'dev' || value === 'prod'
}

/** Resolve the backend for this build (CI's explicit values win). */
export function resolveBackend(root: string, mode: string): BackendEnv {
    // On CI only the workflow's explicit values count: a missing variable
    // must give a build with no backend and no trusted keys, never dev's.
    if (process.env.CI || process.env.VITE_SUPABASE_URL)
        return {
            backend: 'ci',
            url: process.env.VITE_SUPABASE_URL ?? '',
            publishableKey: process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? '',
            envName: process.env.VITE_REMAPPR_ENV ?? '',
            signingKeys: process.env.VITE_SIGNING_PUBLIC_KEYS ?? '',
            authSiteUrl: process.env.VITE_AUTH_SITE_URL ?? '',
        }
    const env = loadEnv(mode, root, '')
    const chosen = process.env.REMAPPR_BACKEND ?? env.REMAPPR_BACKEND
    if (chosen && !isBackend(chosen))
        throw new Error(
            `REMAPPR_BACKEND=${chosen}: expected local, dev or prod`,
        )
    const backend: Backend = isBackend(chosen) ? chosen : DEFAULT_BACKEND
    const prefix = backend.toUpperCase()
    return {
        backend,
        url: env[`${prefix}_SUPABASE_URL`] ?? '',
        publishableKey: env[`${prefix}_SUPABASE_PUBLISHABLE_KEY`] ?? '',
        envName: ENV_NAME[backend],
        signingKeys: env[`${prefix}_SIGNING_PUBLIC_KEYS`] ?? '',
        authSiteUrl: env[`${prefix}_AUTH_SITE_URL`] || AUTH_SITE[backend],
    }
}

/** Resolve, expose the URL and key as VITE_ env for this build, and return
 *  the defines for __REMAPPR_ENV__ and __REMAPPR_EXTRA_KEYS__. */
export function backendDefine(
    root: string,
    mode: string,
): Record<string, string> {
    const chosen = resolveBackend(root, mode)
    process.env.VITE_SUPABASE_URL = chosen.url
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY = chosen.publishableKey
    // A later call (Electron resolves main, preload and renderer separately)
    // then reads the same choice back.
    process.env.VITE_REMAPPR_ENV = chosen.envName
    process.env.VITE_SIGNING_PUBLIC_KEYS = chosen.signingKeys
    process.env.VITE_AUTH_SITE_URL = chosen.authSiteUrl
    const extra = parseSigningKeys(chosen.signingKeys, chosen.envName)
    if (mode !== 'test')
        console.info(
            `[remappr] backend: ${chosen.backend} (${chosen.url || 'none'}; trusted keys: ${chosen.envName || 'none'})`,
        )
    return {
        __REMAPPR_ENV__: JSON.stringify(chosen.envName),
        __REMAPPR_EXTRA_KEYS__: JSON.stringify(extra),
    }
}
