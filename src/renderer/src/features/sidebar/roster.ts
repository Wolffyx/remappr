// Pattern check: no GoF pattern (-) — rejected — pure data types plus two ordering/grouping functions over roster entries; plain functions are enough.
//
// The device roster: every device the editor can switch to right now, from
// whatever source knows about it (listed transports, a dongle's nodes, the
// demo set). The sidebar's strip, rail and picker all read this one list.
import type { LucideIcon } from 'lucide-react'

/** How a group of devices is reached. */
export type RosterGroupKind = 'direct' | 'dongle' | 'demo'

export interface RosterGroup {
    id: string
    label: string
    kind: RosterGroupKind
}

/** Picker filter chips: what a device is, coarsely. */
export type RosterKind = 'keyboard' | 'mouse' | 'stick' | 'pad' | 'other'

export interface RosterEntry {
    /** Stable across sessions: pins and recents are stored by it. */
    key: string
    name: string
    /** One short line: "Keyboard · USB", "Mouse · via dongle". */
    detail: string
    icon: LucideIcon
    kind: RosterKind
    group: RosterGroup
    /** Reachable now (an asleep or offline node is listed but greyed). */
    online: boolean
    /** The device the editor is showing. */
    active: boolean
    open: () => Promise<void>
}

/** The strip shows at most this many icons before "+N". */
export const STRIP_MAX = 5

/** Strip order: the active device, then pinned ones, then the most recently
 *  used, then the rest in roster order. */
export function stripOrder(
    entries: readonly RosterEntry[],
    pinned: readonly string[],
    recent: readonly string[],
): RosterEntry[] {
    const rank = (e: RosterEntry): number => {
        if (e.active) return -2
        if (pinned.includes(e.key)) return -1
        const r = recent.indexOf(e.key)
        return r === -1 ? Number.MAX_SAFE_INTEGER : r
    }
    return entries
        .map((e, i) => ({ e, i, r: rank(e) }))
        .sort((a, b) => a.r - b.r || a.i - b.i)
        .map(({ e }) => e)
}

/** Entries bucketed by group, groups in first-seen order. */
export function groupRoster(
    entries: readonly RosterEntry[],
): { group: RosterGroup; entries: RosterEntry[] }[] {
    const out = new Map<
        string,
        { group: RosterGroup; entries: RosterEntry[] }
    >()
    for (const e of entries) {
        const bucket = out.get(e.group.id) ?? { group: e.group, entries: [] }
        bucket.entries.push(e)
        out.set(e.group.id, bucket)
    }
    return [...out.values()]
}
