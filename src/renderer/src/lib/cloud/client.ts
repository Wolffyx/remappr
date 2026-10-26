// Pattern check: no GoF pattern (-) — rejected — a memoized lazy loader that
// returns the Supabase client or null; one seam, nothing to abstract.
//
// The one place the app creates its Supabase client. supabase-js loads lazily,
// so builds and sessions that never touch the cloud never download it. With no
// backend configured (see ./env) this resolves null and callers stay local.
import type { SupabaseClient } from '@supabase/supabase-js'
import { isElectron } from '@/transport'
import { createAuthStorage } from './authStorage'
import { cloudConfig } from './env'
import type { Database } from './database.types'

export type CloudClient = SupabaseClient<Database>

let pending: Promise<CloudClient | null> | null = null

async function createCloudClient(): Promise<CloudClient | null> {
    const config = cloudConfig()
    if (!config) return null
    const { createClient } = await import('@supabase/supabase-js')
    const electron = isElectron()
    return createClient<Database>(config.url, config.publishableKey, {
        auth: {
            flowType: 'pkce',
            // Electron gets the code over the remappr:// deep link instead.
            detectSessionInUrl: !electron,
            persistSession: true,
            autoRefreshToken: true,
            storage: createAuthStorage(),
        },
    })
}

/** The shared Supabase client, or null when this build has no backend. */
export function getCloudClient(): Promise<CloudClient | null> {
    pending ??= createCloudClient()
    return pending
}
