// Pattern check: no GoF pattern (-) — rejected — module-level Map memoization for hot-path O(1) lookup; not Singleton (no encapsulation/lifecycle), no abstraction.
// keyboard-and-consumer-usage-tables.json is pages 7 + 12 filtered out of the
// full USB-IF HidUsageTables-1.5.json (https://usb.org/document-library/hid-usage-tables-15)
// via: jq '{ UsagePages: [.UsagePages[] | select([.Id] | inside([7, 12]))] }'
import { UsagePages } from '@/data/keyboard-and-consumer-usage-tables.json'
import HidOverrides from '@firmware/catalog/hid-pages/overrides.json'
import { abbreviateKeyName } from '@/lib/keyAbbreviations'

interface HidLabels {
    short?: string
    med?: string
    long?: string
}

const overrides: Record<string, Record<string, HidLabels>> = HidOverrides

export interface UsageId {
    Id: number
    Name: string
}

export interface UsagePageInfo {
    Id: number
    Name: string
    UsageIds: UsageId[]
}

// Nested page → id → name Map so the per-key label lookup is O(1); the
// consumer page (0x0c) alone has ~670 usage ids, and a linear scan there ran
// once per key per keymap render.
const usageNamesByPage = new Map<number, Map<number, string>>(
    UsagePages.map((p: UsagePageInfo): [number, Map<number, string>] => [
        p.Id,
        new Map(
            (p.UsageIds ?? []).map((u: UsageId): [number, string] => [
                u.Id,
                u.Name,
            ]),
        ),
    ]),
)

export const hidUsageFromPageAndId = (page: number, id: number): number =>
    (page << 16) + id

export const hidUsagePageAndIdFromUsage = (usage: number): [number, number] => [
    (usage >> 16) & 0xffff,
    usage & 0xffff,
]

// The Button page (mouse buttons in a mouse macro) has no names in the tables
// above; name its usages the way the key catalog does ("Mouse button 1").
const HID_PAGE_BUTTON = 0x09

export const hid_usage_get_labels = (
    usage_page: number,
    usage_id: number,
): {
    short?: string
    med?: string
    long?: string
} =>
    overrides[usage_page.toString()]?.[usage_id.toString()] ||
    (usage_page === HID_PAGE_BUTTON
        ? { short: `MS B${usage_id}`, long: `Mouse button ${usage_id}` }
        : { short: usageNamesByPage.get(usage_page)?.get(usage_id) })

/**
 * Full, human-readable label for a HID usage (e.g. "ErrorUndefined", "Volume
 * Up") with the leading "Keyboard " noun stripped. Unlike {@link usageGlyph} it
 * never abbreviates — used for hover tooltips where the whole name should show.
 * Shared by `HidUsageLabel` and the editor stage so both resolve names the same.
 */
export const hidUsageLongLabel = (usage: number): string | undefined => {
    const [page, id] = hidUsagePageAndIdFromUsage(usage)
    const labels = hid_usage_get_labels(page & 0xff, id)
    const long = labels.long || labels.med || labels.short
    return long ? long.replace(/^Keyboard /, '') : undefined
}

/**
 * Resolve a HID usage to its short display glyph (e.g. "Q", "Tab", "Esc").
 * The single source of truth shared by `HidUsageLabel` (live caps) and the
 * device-preview snapshot (serializable cached legends) so both stay in sync.
 * Strips the leading "Keyboard " noun and abbreviates to `maxLength` chars.
 */
export const usageGlyph = (usage: number, maxLength = 5): string => {
    const [page, id] = hidUsagePageAndIdFromUsage(usage)
    const short = hid_usage_get_labels(page & 0xff, id).short?.replace(
        /^Keyboard /,
        '',
    )
    return short ? abbreviateKeyName(short, maxLength) : ''
}

// Implicit modifiers packed in a HID usage's high byte (bits 24–31). Maps each
// set L/R pair to a friendly name (Ctrl/Shift/Alt/Gui), deduped — feeds the cap's
// chord chips.
const USAGE_MOD_BITS: Array<[number, string]> = [
    [0x01, 'Ctrl'],
    [0x02, 'Shift'],
    [0x04, 'Alt'],
    [0x08, 'Gui'],
    [0x10, 'Ctrl'],
    [0x20, 'Shift'],
    [0x40, 'Alt'],
    [0x80, 'Gui'],
]
export const usageModifierNames = (usage: number): string[] => {
    const flags = (usage >> 24) & 0xff
    if (!flags) return []
    return [
        ...new Set(USAGE_MOD_BITS.filter(([b]) => flags & b).map(([, n]) => n)),
    ]
}
