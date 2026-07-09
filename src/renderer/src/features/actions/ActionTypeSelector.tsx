// Pattern check: no GoF pattern (-) — rejected — presentational selector over neutral ActionType list.
import { useMemo, useState } from 'react'
import { ChevronsUpDown } from 'lucide-react'
import type { ActionType } from '@firmware/types'
import { Button } from '@/ui/button'
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from '@/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/ui/popover'
import { cn } from '@/lib/cn'
import { LegendGlyph } from '@/features/keymap/keyboard/LegendGlyph'

// pattern-check: skip optional hideIds dropdown filter — mechanical filter, sortedVisible split from selected lookup
export interface ActionTypeSelectorProps {
    actionTypes: ActionType[]
    selectedId: string
    onSelect: (id: string) => void
    placeholder?: string
    className?: string
    // Hide these ids from the dropdown list (still resolvable for the
    // selected-label lookup so existing bindings whose kind is hidden
    // still display). Used by KeyActionPicker to drop ZMK runtime
    // &macro_* / &combo_* behaviors — those have catalog tiles.
    hideIds?: ReadonlySet<string>
}

export const ActionTypeSelector = ({
    actionTypes,
    selectedId,
    onSelect,
    placeholder = 'Select action...',
    className,
    hideIds,
}: ActionTypeSelectorProps): JSX.Element => {
    const [open, setOpen] = useState(false)

    const sortedVisible = useMemo(
        (): ActionType[] =>
            [...actionTypes]
                .filter((t) => !hideIds?.has(t.id))
                .sort((a, b) => a.displayName.localeCompare(b.displayName)),
        [actionTypes, hideIds],
    )

    const selected = useMemo(
        (): ActionType | undefined =>
            actionTypes.find((t): boolean => t.id === selectedId),
        [actionTypes, selectedId],
    )

    const handleSelect = (id: string): void => {
        onSelect(id)
        setOpen(false)
    }

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className={cn('w-64 justify-between', className)}
                >
                    <span className="inline-flex items-center gap-1.5 truncate">
                        <LegendGlyph
                            id={selected?.icon}
                            className="h-4 w-4 shrink-0"
                        />
                        {selected ? selected.displayName : placeholder}
                    </span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-0">
                <Command>
                    <CommandInput placeholder="Search actions..." />
                    <CommandList>
                        <CommandEmpty>No action found.</CommandEmpty>
                        <CommandGroup>
                            {sortedVisible.map((t) => (
                                <CommandItem
                                    key={t.id}
                                    value={t.displayName}
                                    onSelect={() => handleSelect(t.id)}
                                >
                                    {/* Fixed icon slot: reserved whether or not
                                        the behavior resolves an icon, so icon-
                                        less rows (Key Press…) align their text
                                        with icon'd rows — a two-column table. */}
                                    <span className="flex w-4 shrink-0 items-center justify-center">
                                        <LegendGlyph
                                            id={t.icon}
                                            className="h-4 w-4"
                                        />
                                    </span>
                                    <span>{t.displayName}</span>
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    )
}
