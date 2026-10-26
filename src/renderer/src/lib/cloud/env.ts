// pattern-check: skip — reads two build-time env vars into a config or null.
//
// The cloud backend is optional. A build without both Supabase vars has no
// cloud at all: every cloud feature hides and the app stays local-only.

export interface CloudConfig {
    url: string
    publishableKey: string
}

type CloudEnv = Pick<
    ImportMetaEnv,
    'VITE_SUPABASE_URL' | 'VITE_SUPABASE_PUBLISHABLE_KEY'
>

/** The Supabase project this build talks to, or null when none is configured. */
export function cloudConfig(
    env: CloudEnv = import.meta.env,
): CloudConfig | null {
    const url = env.VITE_SUPABASE_URL?.trim()
    const publishableKey = env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim()
    if (!url || !publishableKey) return null
    return { url, publishableKey }
}

export function isCloudConfigured(): boolean {
    return cloudConfig() !== null
}
