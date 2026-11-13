// Pattern check: no GoF pattern (-) — rejected — presentational rail over groupRoster(); dongle groups fold with local state, no abstraction needed.
import { Fragment, useState, type JSX } from 'react'
import { ChevronDown, ChevronRight, PanelLeftOpen, Search } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/ui/tooltip'
import { cn } from '@/lib/cn'
import { DeviceIconButton } from './DeviceIconButton'
import { groupRoster, type RosterEntry } from './roster'

/** A layer or profile as a number on the folded rail. */
export interface FoldItem {
    id: string | number
    label: string
    name: string
    active: boolean
    select: () => void
}

const RAIL_BTN =
    'grid size-9 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'

/** A dongle's nodes in a box that folds to its count. */
function DongleGroup({
    label,
    entries,
}: {
    label: string
    entries: readonly RosterEntry[]
}): JSX.Element {
    const [open, setOpen] = useState(true)
    const Chevron = open ? ChevronDown : ChevronRight
    return (
        <div className="flex w-[42px] flex-col items-center gap-1 rounded-md bg-foreground/[.05] py-1">
            <Tooltip>
                <TooltipTrigger asChild>
                    <button
                        type="button"
                        onClick={(): void => setOpen(!open)}
                        aria-expanded={open}
                        aria-label={`${label}, ${entries.length} devices`}
                        className="flex h-5 items-center gap-0.5 font-mono text-meta font-bold text-muted-foreground hover:text-foreground"
                    >
                        <Chevron className="size-3" />
                        {entries.length}
                    </button>
                </TooltipTrigger>
                <TooltipContent side="right">{label}</TooltipContent>
            </Tooltip>
            {open &&
                entries.map((e) => (
                    <DeviceIconButton
                        key={e.key}
                        entry={e}
                        size="rail"
                        side="right"
                    />
                ))}
        </div>
    )
}

/** Every device as an icon, grouped by how it connects. Folded, the rail
 *  also carries the layers (or profiles) as numbers. */
export function DeviceRail({
    entries,
    onOpenPicker,
    fold,
}: {
    entries: readonly RosterEntry[]
    onOpenPicker: () => void
    fold?: { items: readonly FoldItem[]; onExpand: () => void }
}): JSX.Element {
    const groups = groupRoster(entries)
    return (
        <nav
            aria-label="Devices"
            className="flex w-[52px] shrink-0 flex-col items-center gap-1.5 overflow-y-auto border-r border-sidebar-border bg-[color-mix(in_oklab,var(--sidebar)_80%,var(--background))] py-2.5"
        >
            {groups.map(({ group, entries: inGroup }, i) => (
                <Fragment key={group.id}>
                    {i > 0 && (
                        <span className="my-0.5 h-px w-6 bg-sidebar-border" />
                    )}
                    {group.kind === 'dongle' ? (
                        <DongleGroup label={group.label} entries={inGroup} />
                    ) : (
                        inGroup.map((e) => (
                            <DeviceIconButton
                                key={e.key}
                                entry={e}
                                size="rail"
                                side="right"
                            />
                        ))
                    )}
                </Fragment>
            ))}
            {fold && fold.items.length > 0 && (
                <>
                    <span className="my-0.5 h-px w-6 bg-sidebar-border" />
                    {fold.items.map((it) => (
                        <Tooltip key={it.id}>
                            <TooltipTrigger asChild>
                                <button
                                    type="button"
                                    onClick={it.select}
                                    aria-label={it.name}
                                    aria-current={
                                        it.active ? 'true' : undefined
                                    }
                                    className={cn(
                                        'h-7 w-8 shrink-0 rounded-md font-mono text-control font-bold text-muted-foreground transition-colors hover:bg-sidebar-accent',
                                        it.active &&
                                            'bg-[color-mix(in_oklab,var(--primary)_14%,var(--sidebar))] text-primary',
                                    )}
                                >
                                    {it.label}
                                </button>
                            </TooltipTrigger>
                            <TooltipContent side="right">
                                {it.name}
                            </TooltipContent>
                        </Tooltip>
                    ))}
                </>
            )}
            <div className="mt-auto flex flex-col items-center gap-1 pt-2">
                <Tooltip>
                    <TooltipTrigger asChild>
                        <button
                            type="button"
                            onClick={onOpenPicker}
                            aria-label="All devices"
                            className={RAIL_BTN}
                        >
                            <Search className="size-4" />
                        </button>
                    </TooltipTrigger>
                    <TooltipContent side="right">
                        All devices · ⌘⇧D
                    </TooltipContent>
                </Tooltip>
                {fold && (
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <button
                                type="button"
                                onClick={fold.onExpand}
                                aria-label="Open the panel"
                                className={RAIL_BTN}
                            >
                                <PanelLeftOpen className="size-4" />
                            </button>
                        </TooltipTrigger>
                        <TooltipContent side="right">
                            Open the panel
                        </TooltipContent>
                    </Tooltip>
                )}
            </div>
        </nav>
    )
}
