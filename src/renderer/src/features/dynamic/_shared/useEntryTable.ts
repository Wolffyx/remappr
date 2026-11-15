// Pattern check: no GoF pattern (-) — rejected — state hook over the pure entryTable model (load once, drafts, reveal, save); the per-section Strategy is the EntrySpec it receives.
//
// One section's table state: loads every slot when the section opens, keeps
// edits as drafts, and writes them back on Save.
import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'

import {
    firstFree,
    loadAll,
    sameEntry,
    saveDrafts,
    usedCount,
    visibleRows,
    type EntrySpec,
} from './entryTable'

export interface EntryTableState<T> {
    spec: EntrySpec<T>
    /** Slots on this device (the read pool size when the count is a limit). */
    count: number
    loading: boolean
    /** The slots could not be read. */
    failed: boolean
    /** Saved value overlaid with the draft, per slot (undefined while loading). */
    entry: (idx: number) => T | undefined
    rows: number[]
    used: number
    nextFree: number | null
    dirty: ReadonlySet<number>
    readOnly: boolean
    update: (idx: number, next: T | ((prev: T) => T)) => void
    clear: (idx: number) => void
    /** Lists an empty slot (New, Go to #); returns it, or null when none. */
    reveal: (idx?: number) => number | null
    save: () => Promise<void>
}

export function useEntryTable<T>(
    spec: EntrySpec<T>,
    opened: boolean,
): EntryTableState<T> {
    const [base, setBase] = useState<T[]>([])
    const [drafts, setDrafts] = useState<ReadonlyMap<number, T>>(new Map())
    const [revealed, setRevealed] = useState<ReadonlySet<number>>(new Set())
    const [loading, setLoading] = useState(false)
    const [failed, setFailed] = useState(false)

    /* eslint-disable react-hooks/set-state-in-effect */
    useEffect(() => {
        if (!opened) return
        let cancelled = false
        setLoading(true)
        setFailed(false)
        setDrafts(new Map())
        setRevealed(new Set())
        loadAll(
            spec.count,
            (i) => spec.fetch(i),
            () => cancelled,
            spec.countIsLimit,
        )
            .then((all) => {
                if (all) setBase(all)
            })
            .catch((e: unknown) => {
                console.error(e)
                if (cancelled) return
                setBase([])
                setFailed(true)
                toast.error(`Failed to load ${spec.noun} entries`)
            })
            .finally(() => {
                if (!cancelled) setLoading(false)
            })
        return () => {
            cancelled = true
        }
    }, [spec, opened])
    /* eslint-enable react-hooks/set-state-in-effect */

    const entry = useCallback(
        (idx: number): T | undefined => drafts.get(idx) ?? base[idx],
        [drafts, base],
    )
    const merged = useMemo(() => base.map((_, i) => entry(i)), [base, entry])

    const count = spec.countIsLimit ? base.length : spec.count

    const update = useCallback(
        (idx: number, next: T | ((prev: T) => T)): void => {
            setDrafts((prev) => {
                const cur = prev.get(idx) ?? base[idx]
                if (cur === undefined) return prev
                const value =
                    typeof next === 'function'
                        ? (next as (p: T) => T)(cur)
                        : next
                const out = new Map(prev)
                if (sameEntry(value, base[idx])) out.delete(idx)
                else out.set(idx, value)
                return out
            })
        },
        [base],
    )

    const clear = useCallback(
        (idx: number): void => {
            update(idx, spec.blank())
            setRevealed((prev) => new Set(prev).add(idx))
        },
        [update, spec],
    )

    const reveal = useCallback(
        (idx?: number): number | null => {
            const at = idx ?? firstFree(merged, spec.isEmpty, revealed)
            if (at === null || at < 0 || at >= count) return null
            setRevealed((prev) => new Set(prev).add(at))
            return at
        },
        [merged, spec, revealed, count],
    )

    const save = useCallback(async (): Promise<void> => {
        if (!spec.store || drafts.size === 0) return
        const { saved, error } = await saveDrafts(drafts, (i, e) =>
            spec.store!(i, e),
        )
        setBase((prev) => {
            const out = prev.slice()
            for (const i of saved) out[i] = drafts.get(i)!
            return out
        })
        setDrafts((prev) => {
            const out = new Map(prev)
            for (const i of saved) out.delete(i)
            return out
        })
        if (error === undefined) {
            toast.success(
                saved.length === 1
                    ? `Saved ${spec.noun} #${saved[0]}`
                    : `Saved ${saved.length} ${spec.noun} entries`,
            )
            return
        }
        const detail = error instanceof Error ? error.message : String(error)
        toast.error(`Failed to save ${spec.noun}: ${detail}`)
        console.error(error)
    }, [drafts, spec])

    return {
        spec,
        count,
        loading,
        failed,
        entry,
        rows: visibleRows(merged, spec.isEmpty, revealed),
        used: usedCount(merged, spec.isEmpty),
        nextFree: firstFree(merged, spec.isEmpty, revealed),
        dirty: new Set(drafts.keys()),
        readOnly: !spec.store,
        update,
        clear,
        reveal,
        save,
    }
}
