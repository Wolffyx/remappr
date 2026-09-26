// Pattern check: no GoF pattern (-) — rejected — codemod renaming UsageId to CatalogEntry, field references Label→label/Id→id; pure type swap.
import type { CatalogEntry } from '@firmware/catalog/types'
import type { KeyCategory } from '@/lib/keymap/keyCategory'

export enum Mods {
    LeftControl = 0x01,
    LeftShift = 0x02,
    LeftAlt = 0x04,
    LeftGUI = 0x08,
    RightControl = 0x10,
    RightShift = 0x20,
    RightAlt = 0x40,
    RightGUI = 0x80,
}

const all_mods: readonly Mods[] = [
    Mods.LeftControl,
    Mods.LeftShift,
    Mods.LeftAlt,
    Mods.LeftGUI,
    Mods.RightControl,
    Mods.RightShift,
    Mods.RightAlt,
    Mods.RightGUI,
]

const MODS_FLAGS_SHIFTED =
    all_mods.reduce((a: number, v: Mods): number => a | v, 0) << 24

export function maskMods(value: number): number {
    return value & ~MODS_FLAGS_SHIFTED
}

// pattern-check: skip pure helper for filterKeysBySearch ranking — single private caller
// Pattern check: no GoF pattern (-) — rejected — table-driven scoring of label/name/id/aliases for picker filter, single caller, no abstraction.
//
// Per-field scoring table. Higher = better. `prefix: 0` disables the
// prefix tier for that field (e.g. `id` only contributes via exact /
// contains). Order in the table doesn't matter — best-of-all wins.
const SCORE_FIELDS: ReadonlyArray<{
    values: (e: CatalogEntry) => readonly string[]
    exact: number
    prefix: number
    contains: number
}> = [
    {
        values: (e) => [e.label],
        exact: 100,
        prefix: 50,
        contains: 20,
    },
    { values: (e) => [e.name], exact: 90, prefix: 40, contains: 15 },
    { values: (e) => e.aliases ?? [], exact: 80, prefix: 30, contains: 10 },
    { values: (e) => [e.id], exact: 70, prefix: 0, contains: 12 },
]

const matchTier = (
    s: string,
    lq: string,
    exact: number,
    prefix: number,
    contains: number,
): number =>
    s === lq
        ? exact
        : prefix && s.startsWith(lq)
          ? prefix
          : contains && s.includes(lq)
            ? contains
            : 0

function scoreEntry(entry: CatalogEntry, lq: string): number {
    return Math.max(
        0,
        ...SCORE_FIELDS.flatMap(({ values, exact, prefix, contains }) =>
            values(entry).map((raw) =>
                matchTier(raw.toLowerCase(), lq, exact, prefix, contains),
            ),
        ),
    )
}

// pattern-check: skip refinement of existing pure filter — substring → ranked filter+sort, same call sites
export function filterKeysBySearch(
    keys: CatalogEntry[],
    query: string,
): CatalogEntry[] {
    if (!query.trim()) return keys
    const lq = query.toLowerCase()
    const scored: { entry: CatalogEntry; score: number; idx: number }[] = []
    keys.forEach((entry, idx) => {
        const score = scoreEntry(entry, lq)
        if (score > 0) scored.push({ entry, score, idx })
    })
    scored.sort((a, b) => b.score - a.score || a.idx - b.idx)
    return scored.map((s) => s.entry)
}

export function splitKeysByPosition(keys: CatalogEntry[]): {
    withPositions: CatalogEntry[]
    withoutPositions: CatalogEntry[]
} {
    const withPositions = keys.filter(
        (key) =>
            key.x !== undefined &&
            key.y !== undefined &&
            key.x !== null &&
            key.y !== null,
    )
    const withoutPositions = keys.filter(
        (key) =>
            key.x === undefined ||
            key.y === undefined ||
            key.x === null ||
            key.y === null,
    )
    return { withPositions, withoutPositions }
}

const KEY_SIZE = 50
const AVG_KEY_WIDTH = 60
const APPROX_CONTAINER_WIDTH = 800
const ROW_HEIGHT = 60
const PADDING = 48
const STACK_GAP = 10
const MIN_HEIGHT = 350

export function calculateContainerHeight(
    withPositions: CatalogEntry[],
    withoutPositions: CatalogEntry[],
): number {
    const maxBottomPosition = maxBottomForPositioned(withPositions)

    let keysWithoutPosHeight = 0
    if (withoutPositions.length > 0) {
        const keysPerRow = Math.floor(APPROX_CONTAINER_WIDTH / AVG_KEY_WIDTH)
        const numRows = Math.ceil(withoutPositions.length / keysPerRow)
        keysWithoutPosHeight = numRows * ROW_HEIGHT
    }

    const totalContentHeight =
        withPositions.length > 0 && withoutPositions.length > 0
            ? maxBottomPosition + STACK_GAP + keysWithoutPosHeight + PADDING
            : Math.max(
                  maxBottomPosition + PADDING,
                  keysWithoutPosHeight + PADDING,
              )
    return Math.max(totalContentHeight, MIN_HEIGHT)
}

export function maxBottomForPositioned(withPositions: CatalogEntry[]): number {
    let maxBottom = 0
    withPositions.forEach((key) => {
        const keyHeight = key.h ? key.h / 2 : KEY_SIZE
        const bottomPosition = ((key.y ?? 0) / 100) * KEY_SIZE + keyHeight
        if (bottomPosition > maxBottom) maxBottom = bottomPosition
    })
    return maxBottom
}

// pattern-check: skip — pure data-grouping helper, single caller, table-driven
// Named keycode sections (design handoff PICKER_KEYBOARD ordering). Each section
// collects one or more function categories. Entries whose category isn't listed
// fall into a trailing "Other" bucket so nothing is dropped.
export const KEYCODE_SECTIONS: ReadonlyArray<{
    title: string
    cats: readonly KeyCategory[]
}> = [
    { title: 'Modifiers', cats: ['mod'] },
    { title: 'Numbers & Symbols', cats: ['num', 'punct'] },
    { title: 'Letters', cats: ['alpha'] },
    { title: 'Editing & Whitespace', cats: ['edit', 'space', 'nav'] },
    { title: 'Function & System', cats: ['system'] },
    { title: 'Layers', cats: ['layer'] },
    { title: 'Media', cats: ['media'] },
    { title: 'Mouse', cats: ['mouse'] },
]

export interface KeycodeSection {
    title: string
    entries: CatalogEntry[]
}

/**
 * Bucket catalog entries into the ordered {@link KEYCODE_SECTIONS} by their
 * function category (resolved via `catOf`). Empty sections are omitted; any
 * entry whose category isn't claimed by a section lands in a final "Other".
 */
export function groupEntriesIntoSections(
    entries: CatalogEntry[],
    catOf: (entry: CatalogEntry) => KeyCategory,
): KeycodeSection[] {
    const catToTitle = new Map<KeyCategory, string>()
    KEYCODE_SECTIONS.forEach(({ title, cats }) =>
        cats.forEach((c) => catToTitle.set(c, title)),
    )
    const OTHER = 'Other'
    const buckets = new Map<string, CatalogEntry[]>()
    for (const entry of entries) {
        const title = catToTitle.get(catOf(entry)) ?? OTHER
        const bucket = buckets.get(title)
        if (bucket) bucket.push(entry)
        else buckets.set(title, [entry])
    }
    const ordered: KeycodeSection[] = []
    for (const { title } of KEYCODE_SECTIONS) {
        const entries = buckets.get(title)
        if (entries?.length) ordered.push({ title, entries })
    }
    const other = buckets.get(OTHER)
    if (other?.length) ordered.push({ title: OTHER, entries: other })
    return ordered
}
