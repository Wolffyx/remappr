// Pattern check: no GoF pattern (-) — rejected — two pure functions that pick
// the library item a board exports to GitHub through.
//
// GitHub sync works on library items (one item ↔ one repo branch), while a
// builder save makes a new snapshot each time. Exporting a board to GitHub
// therefore goes through one library item: one already linked for this
// board, or a new one.
import { parseKeymap, serializeKeymap } from '@firmware/config'
import type { LibraryEntry, LibraryItemType } from '@/lib/library/types'

/** Whether an item already holds this board (`board` serialized): compared
 *  as documents, so a different spelling of the same JSON still matches. */
export function holdsBoard(entry: LibraryEntry, board: string): boolean {
    if (entry.source === board) return true
    try {
        return serializeKeymap(parseKeymap(entry.source)) === board
    } catch {
        // Not a keymap this version reads: it does not hold the board.
        return false
    }
}

/** The items a board can export through: keymaps of its type with its
 *  name, and every linked one (a renamed board keeps its repo). Linked
 *  first, then newest. */
export function exportCandidates(
    entries: readonly LibraryEntry[],
    type: LibraryItemType,
    name: string,
): LibraryEntry[] {
    return entries
        .filter((e) => e.kind === 'remappr.keymap' && e.type === type)
        .filter((e) => e.name === name || e.git)
        .sort(
            (a, b) =>
                Number(Boolean(b.git)) - Number(Boolean(a.git)) ||
                b.updatedAt - a.updatedAt,
        )
}

/** The item to offer first: a linked one with the board's name, else none
 *  (a new item). An unlinked snapshot is never picked for the user: it would
 *  be overwritten. */
export function defaultExportItem(
    candidates: readonly LibraryEntry[],
    name: string,
): string | null {
    return candidates.find((e) => e.git && e.name === name)?.localId ?? null
}
