// pattern-check: skip — section spec + columns for the shared EntryTable
import { useMemo } from 'react'

import type { KeyboardService, TapDanceEntry } from '@firmware'

import { NumChip } from '../_shared/EntryCard'
import { EntryTable, type EntryColumn } from '../_shared/EntryTable'
import type { EntrySpec } from '../_shared/entryTable'
import { KeycodeField } from '../_shared/KeycodeField'
import { useEntryTable } from '../_shared/useEntryTable'

interface Props {
    service: KeyboardService
    count: number
    opened: boolean
    /** Slot to focus when opened from a key bound to it. */
    defaultIndex?: number
}

type Slot = 'onTap' | 'onHold' | 'onDoubleTap' | 'onTapHold'

const keyColumn = (id: Slot, header: string): EntryColumn<TapDanceEntry> => ({
    id,
    header,
    cell: (e, set) => (
        <KeycodeField
            value={e[id]}
            onChange={(v) => set((p) => ({ ...p, [id]: v }))}
        />
    ),
})

const COLUMNS: readonly EntryColumn<TapDanceEntry>[] = [
    keyColumn('onTap', 'Tap'),
    keyColumn('onHold', 'Hold'),
    keyColumn('onDoubleTap', 'Tap twice'),
    keyColumn('onTapHold', 'Tap, then hold'),
    {
        id: 'term',
        header: 'Timing',
        className: 'w-32',
        cell: (e, set) => (
            <span className="flex items-center gap-1.5">
                <NumChip
                    value={e.tappingTerm}
                    onChange={(v) => set((p) => ({ ...p, tappingTerm: v }))}
                />
                <span className="text-caption text-muted-foreground">ms</span>
            </span>
        ),
    },
]

export function TapDanceTab({
    service,
    count,
    opened,
    defaultIndex,
}: Props): JSX.Element {
    const spec = useMemo<EntrySpec<TapDanceEntry>>(
        () => ({
            noun: 'tap dance',
            count,
            fetch: (i) => service.dynamic!.getTapDance(i),
            store: (i, e) => service.dynamic!.setTapDance(i, e),
            isEmpty: (e) =>
                !e.onTap && !e.onHold && !e.onDoubleTap && !e.onTapHold,
            blank: () => ({
                onTap: 0,
                onHold: 0,
                onDoubleTap: 0,
                onTapHold: 0,
                tappingTerm: 200,
            }),
        }),
        [service, count],
    )
    const table = useEntryTable(spec, opened)
    return <EntryTable table={table} columns={COLUMNS} start={defaultIndex} />
}
