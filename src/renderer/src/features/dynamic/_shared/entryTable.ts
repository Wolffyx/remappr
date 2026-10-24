// Pattern check: Strategy (Tier 1) — applied — each dock section supplies an EntrySpec (fetch/store/isEmpty/blank/noun) that one shared EntryTable + useEntryTable run, replacing five near-copy tab bodies.
//
// The model behind the dynamic-entry tables: every slot of a section is read
// once when the section opens, the slots in use are listed, and edits are kept
// as drafts until Save writes them back. Pure, so it is unit-tested.

/** How one section (tap dance, combos, …) reads, writes and judges its slots. */
export interface EntrySpec<T> {
    /** Singular, lower case: "tap dance", "macro". */
    noun: string
    /** Slots the firmware has. */
    count: number
    fetch(idx: number): Promise<T>
    /** Absent on view-only firmware: the table renders read-only. */
    store?(idx: number, entry: T): Promise<void>
    /** A slot that does nothing (all keys none, no steps). */
    isEmpty(entry: T): boolean
    /** What Clear writes. */
    blank(): T
}

/** The first empty slot not already listed (`skip`), or null when none. */
export function firstFree<T>(
    entries: readonly (T | undefined)[],
    isEmpty: (e: T) => boolean,
    skip: ReadonlySet<number> = new Set(),
): number | null {
    const i = entries.findIndex(
        (e, k) => !skip.has(k) && (e === undefined || isEmpty(e)),
    )
    return i < 0 ? null : i
}

export function usedCount<T>(
    entries: readonly (T | undefined)[],
    isEmpty: (e: T) => boolean,
): number {
    return entries.filter((e) => e !== undefined && !isEmpty(e)).length
}

/** Rows to list: every slot in use, plus empty slots the user opened (New,
 *  Go to #, or one they just cleared), in slot order. */
export function visibleRows<T>(
    entries: readonly (T | undefined)[],
    isEmpty: (e: T) => boolean,
    revealed: ReadonlySet<number>,
): number[] {
    return entries.flatMap((e, i) =>
        revealed.has(i) || (e !== undefined && !isEmpty(e)) ? [i] : [],
    )
}

/** Same content, compared structurally (entries are plain data). */
export function sameEntry<T>(a: T, b: T): boolean {
    return JSON.stringify(a) === JSON.stringify(b)
}

/** Reads slots 0…count-1 one after another (the transport is serial anyway),
 *  stopping early when `cancelled` turns true. */
export async function loadAll<T>(
    count: number,
    fetch: (idx: number) => Promise<T>,
    cancelled: () => boolean,
): Promise<T[] | null> {
    const out: T[] = []
    for (let i = 0; i < count; i++) {
        if (cancelled()) return null
        out.push(await fetch(i))
    }
    return cancelled() ? null : out
}

/** Writes each draft in slot order; returns the slots that saved and the
 *  first error, so a partial failure keeps the rest as drafts. */
export async function saveDrafts<T>(
    drafts: ReadonlyMap<number, T>,
    store: (idx: number, entry: T) => Promise<void>,
): Promise<{ saved: number[]; error: unknown }> {
    const saved: number[] = []
    for (const idx of [...drafts.keys()].sort((a, b) => a - b)) {
        try {
            await store(idx, drafts.get(idx)!)
            saved.push(idx)
        } catch (error) {
            return { saved, error }
        }
    }
    return { saved, error: undefined }
}
