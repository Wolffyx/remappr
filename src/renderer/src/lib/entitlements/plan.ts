// Pattern check: no GoF pattern (-) — rejected — one async fetch of two queries
// into the cached snapshot; a single caller (authStore).
//
// Reads the plan from the server: the free plan's limits (is the builder free
// for everyone?) and my_plan (what this user has, anon → the free plan). A
// failed read keeps the last cached answer.
import { createLogger } from '@shared/logger'
import { getCloudClient } from '@/lib/cloud/client'
import { cloudErrorMessage } from '@/lib/cloud/errors'
import { setPlanSnapshot } from './entitlements'

const log = createLogger('Plan')

type Limits = Record<string, unknown>

function grants(limits: unknown, key: string): boolean {
    const value = (limits as Limits | null)?.[key]
    return typeof value === 'number' && value > 0
}

/** Fetch the plan and cache it. Resolves false when it could not be read. */
export async function refreshPlan(): Promise<boolean> {
    const client = await getCloudClient()
    if (!client) return false
    const [free, mine] = await Promise.all([
        client.from('plans').select('limits').eq('key', 'free').maybeSingle(),
        client.rpc('my_plan'),
    ])
    const error = free.error ?? mine.error
    if (error) {
        log.error('plan read failed', cloudErrorMessage(error))
        return false
    }
    const myLimits = (mine.data as { limits?: unknown } | null)?.limits
    setPlanSnapshot({
        freeBuilder: grants(free.data?.limits, 'builder'),
        builder: grants(myLimits, 'builder'),
    })
    return true
}
