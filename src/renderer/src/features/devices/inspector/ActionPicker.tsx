// Pattern check: no GoF pattern (-) — rejected — presentational action picker (search, group filter, chips) over the adapter's catalog; picking reports the id upward.
import { useMemo, useState, type JSX } from 'react'
import { ArrowLeft, Search } from 'lucide-react'
import type { ActionId } from '@firmware/devices/types'
import { cn } from '@/lib/cn'
import type { CatalogIndex } from '@/lib/devices/bindingSummary'
import { categoryAccent } from '@/lib/devices/deviceCategory'

export interface ActionPickerProps {
    title: string
    value: ActionId | null | undefined
    index: CatalogIndex
    onPick: (id: ActionId | null) => void
    onClose: () => void
}

function Chip({
    label,
    accent,
    on,
    onClick,
}: {
    label: string
    accent: string
    on: boolean
    onClick: () => void
}): JSX.Element {
    return (
        <button
            type="button"
            onClick={onClick}
            className="rounded-[7px] border px-2.5 py-[7px] text-[12.5px] font-semibold text-foreground transition-colors"
            style={{
                background: on
                    ? 'color-mix(in oklch, var(--primary) 22%, var(--secondary))'
                    : `color-mix(in oklch, ${accent} 9%, var(--secondary))`,
                borderColor: on
                    ? 'var(--primary)'
                    : `color-mix(in oklch, ${accent} 28%, var(--border))`,
            }}
        >
            {label}
        </button>
    )
}

/** Covers its container (the inspector dock or sheet) until an action is picked. */
export function ActionPicker({
    title,
    value,
    index,
    onPick,
    onClose,
}: ActionPickerProps): JSX.Element {
    const [q, setQ] = useState('')
    const [group, setGroup] = useState('all')
    const { groups, actions } = index.catalog
    const shown = useMemo(() => {
        const needle = q.trim().toLowerCase()
        return groups
            .filter((g) => group === 'all' || g.id === group)
            .map((g) => ({
                ...g,
                items: actions.filter(
                    (a) =>
                        a.group === g.id &&
                        (!needle || a.label.toLowerCase().includes(needle)),
                ),
            }))
            .filter((g) => g.items.length)
    }, [groups, actions, group, q])

    return (
        <div className="absolute inset-0 z-20 flex flex-col bg-card animate-in fade-in slide-in-from-bottom-2">
            <div className="flex items-center gap-2 border-b border-border px-3.5 py-3">
                <button
                    type="button"
                    aria-label="Back"
                    onClick={onClose}
                    className="grid size-[30px] place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
                >
                    <ArrowLeft className="size-[15px]" />
                </button>
                <div className="min-w-0 flex-1">
                    <div className="text-[13.5px] font-bold">Assign action</div>
                    <div className="truncate text-[11.5px] text-muted-foreground">
                        {title}
                    </div>
                </div>
            </div>
            <div className="flex flex-col gap-2.5 px-3.5 pt-3 pb-2">
                <label className="flex h-9 items-center gap-2 rounded-[9px] border border-border bg-secondary px-[11px]">
                    <Search className="size-[15px] text-muted-foreground" />
                    <input
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                        placeholder="Search actions, keys, macros…"
                        className="flex-1 bg-transparent text-[13px] outline-none"
                    />
                </label>
                <div className="flex flex-wrap gap-[5px]">
                    {[
                        { id: 'all', label: 'All', category: 'none' as const },
                        ...groups,
                    ].map((g) => {
                        const on = group === g.id
                        return (
                            <button
                                key={g.id}
                                type="button"
                                onClick={() => setGroup(g.id)}
                                className={cn(
                                    'inline-flex items-center gap-[5px] rounded-full border px-[9px] py-1 text-[11.5px] font-semibold',
                                    on
                                        ? 'border-transparent bg-foreground text-background'
                                        : 'border-border text-muted-foreground',
                                )}
                            >
                                {g.id !== 'all' && (
                                    <span
                                        className="size-1.5 rounded-sm"
                                        style={{
                                            background: categoryAccent(
                                                g.category,
                                            ),
                                        }}
                                    />
                                )}
                                {g.label}
                            </button>
                        )
                    })}
                </div>
            </div>
            <div className="flex-1 overflow-y-auto px-3.5 pt-1 pb-4">
                <div className="mb-3.5 flex">
                    <Chip
                        label="Disabled"
                        accent="var(--muted-foreground)"
                        on={value == null}
                        onClick={() => onPick(null)}
                    />
                </div>
                {shown.map((g) => (
                    <div key={g.id} className="mb-3.5">
                        <div className="mt-1.5 mb-[7px] text-[10.5px] font-bold tracking-[.08em] text-muted-foreground uppercase">
                            {g.label}
                        </div>
                        <div className="flex flex-wrap gap-[5px]">
                            {g.items.map((a) => (
                                <Chip
                                    key={a.id}
                                    label={a.label}
                                    accent={categoryAccent(a.category)}
                                    on={a.id === value}
                                    onClick={() => onPick(a.id)}
                                />
                            ))}
                        </div>
                    </div>
                ))}
                {!shown.length && (
                    <div className="p-[30px] text-center text-[13px] text-muted-foreground">
                        No actions match “{q}”.
                    </div>
                )}
            </div>
        </div>
    )
}
