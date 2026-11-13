// Pattern check: no GoF pattern (-) — rejected — presentational table over useEntryTable; sections pass columns and an optional detail renderer (the EntrySpec Strategy lives in entryTable.ts).
//
// The dynamic-entry table (design review f14, option F): one row per slot in
// use, one column per setting, every cell its own editor. Changed rows are
// marked until Save; extra settings open under their row, one at a time.
// "Go to #" jumps to (or opens) any slot by number.
import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { ChevronDown, ChevronRight, Plus, X } from 'lucide-react'

import { cn } from '@/lib/cn'
import { clampInt, parseIntSafe } from '@/lib/clampInt'
import { Button } from '@/ui/button'
import { DockActions } from '@/ui/dock-shell'
import { Input } from '@/ui/input'

import type { EntryTableState } from './useEntryTable'

type Setter<T> = (next: T | ((prev: T) => T)) => void

export interface EntryColumn<T> {
    id: string
    header: string
    /** Width / alignment classes for the column. */
    className?: string
    cell: (entry: T, set: Setter<T>, idx: number) => ReactNode
}

interface Props<T> {
    table: EntryTableState<T>
    columns: readonly EntryColumn<T>[]
    /** Extra settings, opened under the row. */
    detail?: (entry: T, set: Setter<T>, idx: number) => ReactNode
    /** Accessible name of the row's open-settings button. */
    detailLabel?: string
    /** Slot to show and focus once loaded (a key's "edit tap dance #n"). */
    start?: number
}

export function EntryTable<T>({
    table,
    columns,
    detail,
    detailLabel = 'More settings',
    start,
}: Props<T>): JSX.Element {
    const { spec } = table
    const [open, setOpen] = useState<number | null>(null)
    const [focus, setFocus] = useState<number | null>(null)
    const rowRefs = useRef(new Map<number, HTMLTableRowElement>())

    useEffect(() => {
        if (focus === null) return
        rowRefs.current.get(focus)?.scrollIntoView({ block: 'nearest' })
        const t = setTimeout(() => setFocus(null), 1600)
        return () => clearTimeout(t)
    }, [focus])

    const jump = (idx: number | null): void => {
        if (idx === null) return
        table.reveal(idx)
        setFocus(idx)
        if (detail) setOpen(idx)
    }

    const started = useRef(false)
    useEffect(() => {
        if (table.loading || start === undefined || started.current) return
        started.current = true
        jump(start)
        // jump is recreated each render; run once, after the first load.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [table.loading, start])

    const span = columns.length + 2

    return (
        <div className="flex flex-col gap-1">
            <DockActions>
                <span className="text-caption text-muted-foreground">
                    {table.used} of {table.count} in use
                </span>
                <GoTo count={table.count} onGo={jump} />
                {!table.readOnly && (
                    <Button
                        size="sm"
                        onClick={() => void table.save()}
                        disabled={table.dirty.size === 0}
                    >
                        {table.dirty.size > 1
                            ? `Save ${table.dirty.size} changes`
                            : 'Save'}
                    </Button>
                )}
            </DockActions>

            {table.loading ? (
                <p className="px-3 py-4 text-control text-muted-foreground">
                    Reading the {spec.noun} entries…
                </p>
            ) : table.failed ? (
                <p className="px-3 pt-4 pb-1 text-control text-muted-foreground">
                    Couldn’t read the {spec.noun} entries from the device.
                </p>
            ) : table.rows.length === 0 ? (
                <p className="px-3 pt-4 pb-1 text-control text-muted-foreground">
                    No {spec.noun} entries yet.
                </p>
            ) : (
                <table className="w-full border-collapse text-control">
                    <thead>
                        <tr className="border-b border-border text-left text-caption text-muted-foreground">
                            <th className="h-9 w-16 px-3 font-semibold">#</th>
                            {columns.map((c) => (
                                <th
                                    key={c.id}
                                    className={cn(
                                        'h-9 px-3 font-semibold',
                                        c.className,
                                    )}
                                >
                                    {c.header}
                                </th>
                            ))}
                            <th className="w-20" aria-label="Row actions" />
                        </tr>
                    </thead>
                    <tbody>
                        {table.rows.map((idx) => {
                            const entry = table.entry(idx)
                            if (entry === undefined) return null
                            const set: Setter<T> = (next) =>
                                table.update(idx, next)
                            const dirty = table.dirty.has(idx)
                            const isOpen = open === idx
                            return (
                                <EntryRow
                                    key={idx}
                                    rowRef={(el) => {
                                        if (el) rowRefs.current.set(idx, el)
                                        else rowRefs.current.delete(idx)
                                    }}
                                    idx={idx}
                                    dirty={dirty}
                                    open={isOpen}
                                    focused={focus === idx}
                                    span={span}
                                    cells={columns.map((c) => (
                                        <td
                                            key={c.id}
                                            className={cn(
                                                'h-12 px-3',
                                                c.className,
                                            )}
                                        >
                                            {c.cell(entry, set, idx)}
                                        </td>
                                    ))}
                                    detail={
                                        detail && isOpen
                                            ? detail(entry, set, idx)
                                            : null
                                    }
                                    onToggle={
                                        detail
                                            ? () => setOpen(isOpen ? null : idx)
                                            : undefined
                                    }
                                    toggleLabel={detailLabel}
                                    onClear={
                                        table.readOnly || spec.isEmpty(entry)
                                            ? undefined
                                            : () => table.clear(idx)
                                    }
                                />
                            )
                        })}
                    </tbody>
                </table>
            )}

            {!table.loading && !table.failed && (
                <Footer table={table} onNew={() => jump(table.reveal())} />
            )}
        </div>
    )
}

function EntryRow({
    rowRef,
    idx,
    dirty,
    open,
    focused,
    span,
    cells,
    detail,
    onToggle,
    toggleLabel,
    onClear,
}: {
    rowRef: (el: HTMLTableRowElement | null) => void
    idx: number
    dirty: boolean
    open: boolean
    focused: boolean
    span: number
    cells: ReactNode
    detail: ReactNode
    onToggle?: () => void
    toggleLabel: string
    onClear?: () => void
}): JSX.Element {
    const Chevron = open ? ChevronDown : ChevronRight
    return (
        <>
            <tr
                ref={rowRef}
                className={cn(
                    'border-b border-border/60 transition-colors',
                    (open || focused) && 'bg-primary/10',
                )}
            >
                <td
                    className={cn(
                        'h-12 px-3',
                        (open || dirty) &&
                            'shadow-[inset_3px_0_0_var(--primary)]',
                    )}
                >
                    <span className="font-mono font-bold text-muted-foreground">
                        #{idx}
                    </span>
                    {dirty && (
                        <span
                            className="ml-1.5 inline-block size-[7px] rounded-full bg-primary align-middle"
                            title="Changed, not saved"
                            aria-label="Changed, not saved"
                        />
                    )}
                </td>
                {cells}
                <td className="h-12 px-2">
                    <span className="flex justify-end gap-1">
                        {onToggle && (
                            <Button
                                variant="ghost"
                                size="icon"
                                className={cn(
                                    'size-7',
                                    open && 'bg-primary/15 text-primary',
                                )}
                                aria-label={toggleLabel}
                                aria-expanded={open}
                                onClick={onToggle}
                            >
                                <Chevron className="size-4" />
                            </Button>
                        )}
                        {onClear && (
                            <Button
                                variant="ghost"
                                size="icon"
                                className="size-7 text-muted-foreground"
                                aria-label={`Clear #${idx}`}
                                title="Clear this entry"
                                onClick={onClear}
                            >
                                <X className="size-4" />
                            </Button>
                        )}
                    </span>
                </td>
            </tr>
            {detail && (
                <tr className="border-b border-border/60 bg-foreground/[.03]">
                    <td colSpan={span} className="py-3 pr-3 pl-[4.5rem]">
                        {detail}
                    </td>
                </tr>
            )}
        </>
    )
}

function GoTo({
    count,
    onGo,
}: {
    count: number
    onGo: (idx: number) => void
}): JSX.Element {
    const [text, setText] = useState('')
    const id = useId()
    return (
        <span className="flex items-center gap-1.5 text-caption text-muted-foreground">
            <label htmlFor={id}>Go to #</label>
            <Input
                id={id}
                value={text}
                inputMode="numeric"
                placeholder="0"
                aria-label="Entry number"
                className="h-7 w-14 px-2 text-center font-mono"
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                    if (e.key !== 'Enter' || text.trim() === '') return
                    onGo(clampInt(parseIntSafe(text), 0, count - 1))
                    setText('')
                }}
            />
        </span>
    )
}

function Footer<T>({
    table,
    onNew,
}: {
    table: EntryTableState<T>
    onNew: () => void
}): JSX.Element | null {
    const { spec } = table
    if (table.readOnly) return null
    if (table.nextFree === null) {
        return (
            <p className="px-3 py-2.5 text-caption text-muted-foreground">
                All {table.count} slots are in use.
            </p>
        )
    }
    const free = table.count - table.used
    return (
        <div className="flex items-center gap-3 px-3 py-2">
            <Button
                variant="ghost"
                size="sm"
                className="text-primary"
                onClick={onNew}
            >
                <Plus className="size-4" />
                New {spec.noun}
            </Button>
            <span className="text-caption text-muted-foreground">
                uses #{table.nextFree} · {free} free
            </span>
        </div>
    )
}
