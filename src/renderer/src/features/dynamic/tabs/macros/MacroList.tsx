// Pattern check: no GoF pattern (-) — rejected — presentational list of macros with a search filter.
//
// The left column: every macro by name, with a one-line summary and where it is
// bound, filtered by a search box. Picking a row opens that macro.
import { Search } from 'lucide-react'
import { useState } from 'react'

import { cn } from '@/lib/cn'
import { Input } from '@/ui/input'

export interface MacroListItem {
    name: string
    summary: string
    /** Where it is bound ("base · key 14"); undefined = the app can't tell. */
    used?: string
}

export function MacroList({
    items,
    selected,
    usedCount,
    onSelect,
}: {
    items: readonly MacroListItem[]
    selected: number
    usedCount: number
    onSelect: (idx: number) => void
}): JSX.Element {
    const [query, setQuery] = useState('')
    const q = query.trim().toLowerCase()
    const shown = items
        .map((item, idx) => ({ item, idx }))
        .filter(
            ({ item }) =>
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
                    className="h-8 pl-8 text-sm"
                />
            </div>
            <div className="-mx-1 flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-1">
                {shown.map(({ item, idx }) => (
                    <button
                        key={idx}
                        type="button"
                        onClick={() => onSelect(idx)}
                        aria-current={idx === selected ? 'true' : undefined}
                        className={cn(
                            'flex w-full flex-col items-start gap-0.5 rounded-lg border px-2.5 py-2 text-left',
                            idx === selected
                                ? 'border-primary/45 bg-primary/10'
                                : 'border-transparent hover:bg-accent/50',
                        )}
                    >
                        <span className="font-mono text-sm font-semibold">
                            {item.name}
                        </span>
                        <span className="w-full truncate text-xs text-muted-foreground">
                            {item.summary}
                        </span>
                        {item.used && (
                            <span className="text-[11px] text-muted-foreground">
                                {item.used}
                            </span>
                        )}
                    </button>
                ))}
                {shown.length === 0 && (
                    <p className="px-2 py-1 text-xs text-muted-foreground">
                        No macro matches “{query}”.
                    </p>
                )}
            </div>
            <span className="text-center text-[11px] text-muted-foreground">
                {usedCount} of {items.length} macro slots used
            </span>
        </aside>
    )
}
