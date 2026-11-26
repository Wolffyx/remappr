// pattern-check: skip — option table for the toolbar-style picker
//
// The toolbar styles as the Settings picker and the search palette show them.
// Each schematic is a tiny board (primary block) with the floating bar above.
import { cn } from '@/lib/cn'
import type { ToolbarStyle } from '@/stores/userSettingsStore'

const board = <div className="w-full flex-1 rounded bg-primary/25" />
const bar = 'rounded-sm bg-foreground/30'

/** The bar over a board. */
const overBoard = (children: JSX.Element[]): JSX.Element => (
    <div className="flex h-full w-full flex-col gap-1 p-1.5">
        <div className="flex items-end justify-center gap-0.5">{children}</div>
        {board}
    </div>
)

const ticks = (n: number, cls: string): JSX.Element[] =>
    Array.from({ length: n }, (_, i) => (
        <div key={i} className={cn(bar, cls)} />
    ))

export const TOOLBAR_STYLE_OPTIONS: readonly {
    value: ToolbarStyle
    label: string
    blurb: string
    schematic: JSX.Element
}[] = [
    {
        value: 'labelled',
        label: 'Labelled',
        blurb: 'Every tool with its name, under group captions.',
        schematic: overBoard(ticks(9, 'h-3 w-2')),
    },
    {
        value: 'compact',
        label: 'Compact',
        blurb: 'Every tool as an icon; names show on hover.',
        schematic: overBoard(ticks(12, 'size-1.5')),
    },
    {
        value: 'groups',
        label: 'Group menus',
        blurb: 'View toggles on the bar, other tools in menus.',
        schematic: overBoard([
            ...ticks(3, 'size-1.5'),
            ...ticks(3, 'h-1.5 w-4'),
        ]),
    },
    {
        value: 'expand',
        label: 'Expanding groups',
        blurb: 'Group chips that open their tools in the bar.',
        schematic: overBoard([
            ...ticks(2, 'h-1.5 w-3'),
            <div key="open" className="h-1.5 w-8 rounded-sm bg-primary/60" />,
            ...ticks(1, 'h-1.5 w-3'),
        ]),
    },
    {
        value: 'search',
        label: 'Search in bar',
        blurb: 'A find box on the bar, then every tool as an icon.',
        schematic: overBoard([
            <div
                key="find"
                className="h-1.5 w-7 rounded-sm border border-foreground/40"
            />,
            ...ticks(8, 'size-1.5'),
        ]),
    },
    {
        value: 'pinned',
        label: 'Pinned + all tools',
        blurb: 'Only tools you pin, plus a panel with everything.',
        schematic: overBoard([
            ...ticks(3, 'h-1.5 w-3'),
            <div key="all" className="h-1.5 w-4 rounded-sm bg-primary/60" />,
        ]),
    },
]
