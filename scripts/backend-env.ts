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
import { loadEnv } from 'vite'

export type Backend = 'local' | 'dev' | 'prod'

/** The signing-key set each backend's builds trust (see license/keys.ts). */
const ENV_NAME: Record<Backend, string> = {
    local: 'local',
    dev: 'staging',
    prod: 'production',
}

export const DEFAULT_BACKEND: Backend = 'dev'

export interface BackendEnv {
    backend: Backend | 'ci'
    url: string
    publishableKey: string
    /** production | staging | local; '' trusts no hosted key. */
    envName: string
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
    }
}

/** Resolve, expose the URL and key as VITE_ env for this build, and return
 *  the define for __REMAPPR_ENV__. */
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
    if (mode !== 'test')
        console.info(
            `[remappr] backend: ${chosen.backend} (${chosen.url || 'none'}; trusted keys: ${chosen.envName || 'none'})`,
        )
    return { __REMAPPR_ENV__: JSON.stringify(chosen.envName) }
}
