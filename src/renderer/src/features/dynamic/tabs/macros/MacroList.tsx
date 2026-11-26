// Pattern check: no GoF pattern (-) — rejected — presentational list of macros with a search filter.
//
// The left column: every macro in use by name, with a one-line summary and where
// it is bound, filtered by a search box. Picking a row opens that macro; a
// changed one carries the unsaved dot. "New macro" opens the next free slot.
import { Plus, Search } from 'lucide-react'
import { useState } from 'react'

import { cn } from '@/lib/cn'
import { Button } from '@/ui/button'
import { Input } from '@/ui/input'

export interface MacroListItem {
    /** The macro's slot. */
    idx: number
    name: string
    summary: string
    /** Where it is bound ("base · key 14"); undefined = the app can't tell. */
    used?: string
    dirty: boolean
}

export function MacroList({
    items,
    selected,
    usedCount,
    slotCount,
    onSelect,
    onNew,
}: {
    items: readonly MacroListItem[]
    selected: number
    usedCount: number
    slotCount: number
    onSelect: (idx: number) => void
    /** Absent when there is no free slot or the firmware can't write macros. */
    onNew?: () => void
}): JSX.Element {
    const [query, setQuery] = useState('')
    const q = query.trim().toLowerCase()
    const shown = items.filter(
        (item) =>
            !q || `${item.name} ${item.summary}`.toLowerCase().includes(q),
    )
    return (
        <aside
            aria-label="Your macros"
            className="flex min-h-0 flex-col gap-2 border-r border-border p-3"
        >
            <div className="relative">
                <Search
                    aria-hidden
                    className="absolute top-2.5 left-2.5 size-3.5 text-muted-foreground"
                />
                <Input
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Find a macro"
                    aria-label="Find a macro"
                    className="h-8 pl-8 text-control"
                />
            </div>
            <div className="-mx-1 flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-1">
                {shown.map((item) => (
                    <button
                        key={item.idx}
                        type="button"
                        onClick={() => onSelect(item.idx)}
                        aria-current={
                            item.idx === selected ? 'true' : undefined
                        }
                        className={cn(
                            'flex w-full flex-col items-start gap-0.5 rounded-lg border px-2.5 py-2 text-left',
                            item.idx === selected
                                ? 'border-primary/45 bg-primary/10'
                                : 'border-transparent hover:bg-accent/50',
                        )}
                    >
                        <span className="flex items-center gap-1.5 font-mono text-control font-semibold">
                            {item.name}
                            {item.dirty && (
                                <span
                                    className="inline-block size-[7px] rounded-full bg-primary"
                                    title="Changed, not saved"
                                    aria-label="Changed, not saved"
                                />
                            )}
                        </span>
                        <span className="w-full truncate text-caption text-muted-foreground">
                            {item.summary}
                        </span>
                        {item.used && (
                            <span className="text-meta text-muted-foreground">
                                {item.used}
                            </span>
                        )}
                    </button>
                ))}
                {shown.length === 0 && (
                    <p className="px-2 py-1 text-caption text-muted-foreground">
                        {q ? `No macro matches “${query}”.` : 'No macros yet.'}
                    </p>
                )}
            </div>
            {onNew && (
                <Button
                    variant="outline"
                    size="sm"
                    className="border-dashed"
                    onClick={onNew}
                >
                    <Plus /> New macro
                </Button>
            )}
            <span className="text-center text-caption text-muted-foreground">
                {usedCount} of {slotCount} macro slots used
            </span>
        </aside>
    )
}
