// Pattern check: no GoF pattern (-) — rejected — presentational command dialog over the roster: search, kind chips, groups, pin toggle; filtering is cmdk's.
import { useState, type JSX } from 'react'
import { Star } from 'lucide-react'
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from '@/ui/command'
import { Dialog, DialogContent, DialogTitle } from '@/ui/dialog'
import { cn } from '@/lib/cn'
import useUserSettingsStore from '@/stores/userSettingsStore'
import { BatteryIndicator } from '@/features/battery/BatteryIndicator'
import { groupRoster, type RosterEntry, type RosterKind } from './roster'

const KIND_CHIPS: readonly { kind: RosterKind | 'all'; label: string }[] = [
    { kind: 'all', label: 'All' },
    { kind: 'keyboard', label: 'Keyboards' },
    { kind: 'mouse', label: 'Mice' },
    { kind: 'stick', label: 'Sticks' },
    { kind: 'pad', label: 'Pads' },
]

/** Every device in one searchable list, grouped by how it connects.
 *  ⏎ switches, ⌘P pins the highlighted device to the strip. */
export function DevicePicker({
    open,
    onOpenChange,
    entries,
}: {
    open: boolean
    onOpenChange: (open: boolean) => void
    entries: readonly RosterEntry[]
}): JSX.Element {
    const [kind, setKind] = useState<RosterKind | 'all'>('all')
    const [highlighted, setHighlighted] = useState('')
    const pinned = useUserSettingsStore((s) => s.pinnedDevices)
    const togglePin = useUserSettingsStore((s) => s.togglePinnedDevice)

    const count = (k: RosterKind | 'all'): number =>
        k === 'all'
            ? entries.length
            : entries.filter((e) => e.kind === k).length
    const chips = KIND_CHIPS.filter(
        (c) => c.kind === 'all' || count(c.kind) > 0,
    )
    const shown =
        kind === 'all' ? entries : entries.filter((e) => e.kind === kind)

    const pick = (e: RosterEntry): void => {
        onOpenChange(false)
        void e.open()
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="overflow-hidden p-0 sm:max-w-md">
                <DialogTitle className="sr-only">Switch device</DialogTitle>
                <Command
                    value={highlighted}
                    onValueChange={setHighlighted}
                    onKeyDown={(e): void => {
                        if (
                            !(e.metaKey || e.ctrlKey) ||
                            e.key.toLowerCase() !== 'p'
                        )
                            return
                        e.preventDefault()
                        const hit = entries.find((x) => x.key === highlighted)
                        if (hit) togglePin(hit.key)
                    }}
                >
                    <CommandInput
                        placeholder={`Search ${entries.length} devices`}
                    />
                    {chips.length > 2 && (
                        <div className="flex flex-wrap gap-1 px-3 pt-2">
                            {chips.map((c) => (
                                <button
                                    key={c.kind}
                                    type="button"
                                    onClick={(): void => setKind(c.kind)}
                                    aria-pressed={kind === c.kind}
                                    className={cn(
                                        'h-6 rounded-full border border-border px-2.5 text-caption font-semibold text-muted-foreground',
                                        kind === c.kind &&
                                            'border-primary/40 bg-primary/15 text-foreground',
                                    )}
                                >
                                    {c.label} {count(c.kind)}
                                </button>
                            ))}
                        </div>
                    )}
                    <CommandList className="max-h-[min(60vh,420px)]">
                        <CommandEmpty>No device matches.</CommandEmpty>
                        {groupRoster(shown).map(
                            ({ group, entries: inGroup }) => (
                                <CommandGroup
                                    key={group.id}
                                    heading={group.label}
                                >
                                    {inGroup.map((e) => {
                                        const Icon = e.icon
                                        const isPinned = pinned.includes(e.key)
                                        return (
                                            <CommandItem
                                                key={e.key}
                                                value={e.key}
                                                keywords={[
                                                    e.name,
                                                    e.detail,
                                                    group.label,
                                                ]}
                                                onSelect={(): void => pick(e)}
                                                className={cn(
                                                    !e.online &&
                                                        'text-muted-foreground',
                                                )}
                                            >
                                                <span
                                                    aria-hidden
                                                    className={cn(
                                                        'size-[7px] rounded-full',
                                                        e.online
                                                            ? 'bg-success'
                                                            : 'bg-muted-foreground',
                                                    )}
                                                />
                                                <Icon />
                                                <span className="min-w-0 flex-1 truncate">
                                                    {e.name}
                                                    {e.active && (
                                                        <span className="ml-2 rounded-full border border-current/40 px-1.5 text-meta font-semibold">
                                                            open
                                                        </span>
                                                    )}
                                                </span>
                                                {e.battery && (
                                                    <BatteryIndicator
                                                        battery={e.battery}
                                                    />
                                                )}
                                                <span className="text-caption text-muted-foreground">
                                                    {e.detail}
                                                </span>
                                                <button
                                                    type="button"
                                                    aria-label={
                                                        isPinned
                                                            ? `Unpin ${e.name}`
                                                            : `Pin ${e.name}`
                                                    }
                                                    aria-pressed={isPinned}
                                                    onClick={(ev): void => {
                                                        ev.stopPropagation()
                                                        togglePin(e.key)
                                                    }}
                                                    className={cn(
                                                        'grid size-6 place-items-center rounded-sm text-muted-foreground hover:text-foreground',
                                                        isPinned &&
                                                            'text-primary',
                                                    )}
                                                >
                                                    <Star
                                                        className={cn(
                                                            isPinned &&
                                                                'fill-current',
                                                        )}
                                                    />
                                                </button>
                                            </CommandItem>
                                        )
                                    })}
                                </CommandGroup>
                            ),
                        )}
                    </CommandList>
                    <div className="flex items-center gap-3 border-t border-border px-3 py-2 text-caption text-muted-foreground">
                        <span>↑↓ move</span>
                        <span>⏎ switch</span>
                        <span>⌘P pin</span>
                        {!entries.some((e) => e.group.kind === 'demo') && (
                            <span className="ml-auto">
                                Plug a device in to add it
                            </span>
                        )}
                    </div>
                </Command>
            </DialogContent>
        </Dialog>
    )
}
