// Pattern check: Dispatch Map (Tier 0) — applied — entry → section key, and
// section key → its heading; the host decides which sections it can open.
import type { LibraryEntry } from '@/lib/library/types'

/** How the Library groups entries: editor keymaps, builder boards, device layouts. */
export type LibrarySection = 'keymap' | 'board' | 'device-layout'

export const SECTION_TITLE: Readonly<Record<LibrarySection, string>> = {
    keymap: 'Keymaps',
    board: 'Boards',
    'device-layout': 'Device layouts',
}

export const SECTION_ORDER: readonly LibrarySection[] = [
    'keymap',
    'board',
    'device-layout',
]

export function sectionOf(entry: LibraryEntry): LibrarySection {
    if (entry.kind === 'remappr.device-layout') return 'device-layout'
    return entry.type === 'device' ? 'board' : 'keymap'
}

/** Opens an entry in the host surface; false = it could not (invalid document). */
export type LibraryOpener = (entry: LibraryEntry) => boolean | Promise<boolean>
