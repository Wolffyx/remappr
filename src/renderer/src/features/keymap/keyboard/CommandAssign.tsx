// Pattern check: no GoF pattern (-) — rejected — cmdk command palette listing catalog
import type { CSSProperties } from 'react'
// entries grouped by category; selection delegates to the caller. Presentational, no abstraction.
import { useMemo } from 'react'
import type { CatalogEntry } from '@firmware/catalog/types'
import { useKeycodeFilter } from '@/hooks/use-keycode-filter'
import useConnectionStore from '@/stores/connectionStore'
import { hidUsagePageAndIdFromUsage } from '@/lib/actions/hidUsages'
import { groupEntriesIntoSections } from '@/lib/keymap/keycodeGrid'
import { categoryForUsage, catStyle } from '@/lib/keymap/keyCategory'
import {
    CommandDialog,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from '@/ui/command'

interface CommandAssignProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    targetCount: number
    onSelect: (entry: CatalogEntry) => void
}

// Keyboard HID page reserved/error usages (ErrorRollOver/POSTFail/ErrorUndefined)
// — never assignable, only clutter the palette. Drop the keyboard page ids < 4.
const KEYBOARD_PAGE = 7
const FIRST_REAL_KEYBOARD_ID = 4

interface PaletteEntry {
    entry: CatalogEntry
    value: number | undefined
}

// Small tinted keycode chip mirroring the picker's KeycodeButton, sized for a list row.
function Chip({
    value,
    label,
}: {
    value: number | undefined
    label: string
}): JSX.Element {
    const cat = value && value !== 0 ? categoryForUsage(value) : 'alpha'
    const cs = catStyle(cat, 'vivid')
    const tinted = !!cs.face
    const style: CSSProperties = {
        background: tinted
            ? `linear-gradient(180deg, ${cs.faceTop}, ${cs.face})`
            : 'var(--secondary)',
        border: `1px solid ${tinted ? `color-mix(in oklab, ${cs.edge} 45%, transparent)` : 'var(--border)'}`,
        color: tinted ? cs.legend : 'var(--foreground)',
        fontFamily:
            cat === 'alpha'
                ? 'var(--font-keycap, Inter, sans-serif)'
                : 'var(--font-mono, "JetBrains Mono", monospace)',
    }
    return (
        <span
            className="inline-flex h-7 min-w-7 max-w-[5.5rem] shrink-0 items-center justify-center overflow-hidden rounded-md px-2 text-xs font-bold"
            style={style}
        >
            <span className="truncate">{label}</span>
        </span>
    )
}

export function CommandAssign({
    open,
    onOpenChange,
    targetCount,
    onSelect,
}: CommandAssignProps): JSX.Element {
    const { pages } = useKeycodeFilter()
    const codec = useConnectionStore((s) => s.service?.codec)

    // Encoded value per assignable entry, used for the category tint and to drop
    // reserved/error keyboard usages that can't be bound.
    const valueByEntryId = useMemo(() => {
        const map = new Map<string, number>()
        if (!codec) return map
        for (const page of pages) {
            for (const entry of page.entries) {
                const enc = codec.encode(entry.id)
                if (enc) map.set(entry.id, enc.value)
            }
        }
        return map
    }, [codec, pages])

    // Sections: keyboard-grid pages split into the design's function categories
    // (Modifiers / Letters / …); other pages stay one group named after the page.
    const groups = useMemo(() => {
        const isAssignable = (entry: CatalogEntry): boolean => {
            if (entry.displayOnly) return false
            if (entry.behaviorRef?.kind) return true
            const value = valueByEntryId.get(entry.id)
            if (value === undefined) return false
            const [page, id] = hidUsagePageAndIdFromUsage(value)
            if (page === KEYBOARD_PAGE && id < FIRST_REAL_KEYBOARD_ID)
                return false
            return true
        }
        const toPaletteEntry = (entry: CatalogEntry): PaletteEntry => ({
            entry,
            value: valueByEntryId.get(entry.id),
        })
        const out: { id: string; heading: string; entries: PaletteEntry[] }[] =
            []
        for (const page of pages) {
            const assignable = page.entries.filter(isAssignable)
            if (assignable.length === 0) continue
            if (page.style === 'keyboard-grid') {
                const sections = groupEntriesIntoSections(assignable, (e) =>
                    categoryForUsage(valueByEntryId.get(e.id)),
                )
                for (const section of sections) {
                    out.push({
                        id: `${page.id}-${section.title}`,
                        heading: section.title,
                        entries: section.entries.map(toPaletteEntry),
                    })
                }
            } else {
                out.push({
                    id: page.id,
                    heading: page.name,
                    entries: assignable.map(toPaletteEntry),
                })
            }
        }
        return out
    }, [pages, valueByEntryId])

    return (
        <CommandDialog
            open={open}
            onOpenChange={onOpenChange}
            title="Assign an action"
        >
            <CommandInput
                placeholder={
                    targetCount > 1
                        ? `Assign keycode to ${targetCount} keys…`
                        : 'Assign keycode to key…'
                }
            />
            <CommandList className="max-h-[min(60vh,420px)]">
                <CommandEmpty>No matching keycodes.</CommandEmpty>
                {groups.map((g) => (
                    <CommandGroup key={g.id} heading={g.heading}>
                        {g.entries.map(({ entry, value }) => (
                            <CommandItem
                                key={entry.id}
                                value={`${entry.label} ${entry.name ?? ''} ${(entry.aliases ?? []).join(' ')}`}
                                onSelect={() => {
                                    onSelect(entry)
                                    onOpenChange(false)
                                }}
                                className="gap-3"
                            >
                                <Chip value={value} label={entry.label} />
                                <span className="font-medium">
                                    {entry.name ?? entry.label}
                                </span>
                                <span className="ml-auto text-xs text-muted-foreground">
                                    {g.heading}
                                </span>
                            </CommandItem>
                        ))}
                    </CommandGroup>
                ))}
            </CommandList>
            <div className="flex items-center gap-4 border-t px-4 py-2.5 text-caption text-muted-foreground">
                <span>
                    <b className="font-mono">↑↓</b> navigate
                </span>
                <span>
                    <b className="font-mono">↵</b> assign
                </span>
                <span>
                    <b className="font-mono">esc</b> close
                </span>
            </div>
        </CommandDialog>
    )
}
