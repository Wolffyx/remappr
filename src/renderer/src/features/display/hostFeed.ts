// Pattern check: no GoF pattern (-) — rejected — pure key planning + a timer loop over the existing HostValuesApi facade.
//
// The host feed (display part design §4-§5): while a device whose screens
// show host values is connected, push the ones it asks for (GET_HOST_KEYS)
// once a second. The time comes from here, the texts from the display
// editor (hostTextStore), the rest from the desktop app's main process (CPU,
// RAM, media, volume; the web app has none of those, so their widgets show
// "--"). A key with no value now is not pushed: the device lets the last one
// expire and shows "--" instead of something stale.
import type { HostValuesApi } from '@firmware/service'
import {
    HOST_STAT_KEYS,
    IpcChannels,
    type HostStatKey,
} from '@shared/ipc-types'
import { getApi } from '@/electron/api'

export type HostValue = number | string | Date

/** Which of the device's keys come from where. */
export interface FeedPlan {
    time: boolean
    /** From the main process. */
    stats: HostStatKey[]
    /** From the editor's texts. */
    texts: string[]
}

const isStat = (k: string): k is HostStatKey =>
    (HOST_STAT_KEYS as readonly string[]).includes(k)

const isText = (k: string): boolean => /^user\d+$/.test(k)

/** The device's keys -> where each value comes from; a key nothing here
 *  answers (a notification, a key this app does not know) is left out. */
export function planFeed(keys: readonly string[]): FeedPlan {
    return {
        time: keys.includes('time'),
        stats: keys.filter(isStat),
        texts: keys.filter(isText),
    }
}

/** The values to push now, in key order; missing or empty ones left out. */
export function feedValues(
    plan: FeedPlan,
    now: Date,
    stats: Readonly<Record<string, number | string>>,
    texts: Readonly<Record<string, string>>,
): [string, HostValue][] {
    const out: [string, HostValue][] = []
    if (plan.time) out.push(['time', now])
    for (const k of plan.stats) {
        const v = stats[k]
        if (v !== undefined && v !== '') out.push([k, v])
    }
    for (const k of plan.texts) {
        if (texts[k]) out.push([k, texts[k]])
    }
    return out
}

/** The main process's values of @p keys; none outside the desktop app. */
export async function readHostStats(
    keys: readonly HostStatKey[],
): Promise<Record<string, number | string>> {
    const api = getApi()
    if (!api || keys.length === 0) return {}
    return (await api.invoke(IpcChannels.HOST_STATS_READ, keys)) as Record<
        string,
        number | string
    >
}

export interface FeedDeps {
    texts: () => Readonly<Record<string, string>>
    readStats?: typeof readHostStats
    /** Between pushes (default 1 s). */
    intervalMs?: number
    /** How often the device is asked again which keys it shows, so a saved
     *  page starts its values (default 5 s). */
    keysEveryMs?: number
    now?: () => Date
}

/**
 * Pushes the device's host values until the returned stop is called. A
 * failed ask or push is logged once (per message) and tried again next time.
 */
export function startHostFeed(api: HostValuesApi, deps: FeedDeps): () => void {
    const interval = deps.intervalMs ?? 1000
    const keysEvery = deps.keysEveryMs ?? 5000
    const readStats = deps.readStats ?? readHostStats
    const now = deps.now ?? (() => new Date())
    let stopped = false
    let timer: ReturnType<typeof setTimeout> | undefined
    let plan: FeedPlan | null = null
    let keysAt = 0
    let lastError = ''

    const tick = async (): Promise<void> => {
        const t = now()
        if (!plan || t.getTime() - keysAt >= keysEvery) {
            plan = planFeed(await api.keys())
            keysAt = t.getTime()
        }
        const stats = plan.stats.length ? await readStats(plan.stats) : {}
        for (const [key, value] of feedValues(plan, t, stats, deps.texts())) {
            if (stopped) return
            await api.set(key, value)
        }
        lastError = ''
    }

    const loop = (): void => {
        if (stopped) return
        tick()
            .catch((e: unknown) => {
                const msg = e instanceof Error ? e.message : String(e)
                if (msg !== lastError) console.warn('Host values:', msg)
                lastError = msg
            })
            .finally(() => {
                if (!stopped) timer = setTimeout(loop, interval)
            })
    }
    loop()
    return () => {
        stopped = true
        clearTimeout(timer)
    }
}
