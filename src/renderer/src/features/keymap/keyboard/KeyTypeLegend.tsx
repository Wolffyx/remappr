// Pattern check: no GoF pattern (-) — rejected — presentational legend mapping hued key
// categories to colour dots via catStyle; pure rendering, no abstraction warranted.
import {
    catStyle,
    CATEGORY_META,
    type KeyCategory,
} from '@/lib/keymap/keyCategory'

// Every hued category, in legend order. Number and Symbol share one hue, so
// they share one entry; letters, space and pass-through stay neutral.
const LEGEND: { cat: KeyCategory; label?: string }[] = [
    { cat: 'mod' },
    { cat: 'layer' },
    { cat: 'nav' },
    { cat: 'edit' },
    { cat: 'num', label: 'Number & symbol' },
    { cat: 'media' },
    { cat: 'mouse' },
    { cat: 'system' },
    { cat: 'conn' },
    { cat: 'light' },
]

/** The hued key categories as a dot list; the sidebar adds the label. */
export function KeyTypeLegend(): JSX.Element {
    return (
        <ul className="flex flex-wrap gap-x-3 gap-y-1.5 px-2 py-1 group-data-[collapsible=icon]:hidden">
            {LEGEND.map(({ cat, label }) => {
                const dot = catStyle(cat, 'vivid').dot
                return (
                    <li
                        key={cat}
                        className="flex items-center gap-1.5 text-caption text-muted-foreground"
                    >
                        <span
                            aria-hidden
                            className="size-2 shrink-0 rounded-[3px]"
                            style={{ background: dot ?? undefined }}
                        />
                        {label ?? CATEGORY_META[cat].label}
                    </li>
                )
            })}
        </ul>
    )
}
