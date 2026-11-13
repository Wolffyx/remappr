// pattern-check: skip — section spec + columns for the shared EntryTable
import { Fragment, useMemo } from 'react'

import type { ComboEntry, KeyboardService } from '@firmware'

import { HexChip } from '../_shared/EntryCard'
import { EntryTable, type EntryColumn } from '../_shared/EntryTable'
import type { EntrySpec } from '../_shared/entryTable'
import { useEntryTable } from '../_shared/useEntryTable'

interface Props {
    service: KeyboardService
    count: number
    opened: boolean
}

const COLUMNS: readonly EntryColumn<ComboEntry>[] = [
    {
        id: 'keys',
        header: 'Press together',
        cell: (e, set) => (
            <span className="flex items-center gap-1.5">
                {e.keys.map((k, i) => (
                    <Fragment key={i}>
                        {i > 0 && (
                            <span className="font-bold text-muted-foreground">
                                +
                            </span>
                        )}
                        <HexChip
                            value={k}
                            onChange={(v) =>
                                set((p) => {
                                    const keys: ComboEntry['keys'] = [...p.keys]
                                    keys[i] = v
                                    return { ...p, keys }
                                })
                            }
                        />
                    </Fragment>
                ))}
            </span>
        ),
    },
    {
        id: 'output',
        header: 'Sends',
        className: 'w-40',
        cell: (e, set) => (
            <HexChip
                value={e.output}
                onChange={(v) => set((p) => ({ ...p, output: v }))}
            />
        ),
    },
]

export function ComboTab({ service, count, opened }: Props): JSX.Element {
    const spec = useMemo<EntrySpec<ComboEntry>>(
        () => ({
            noun: 'combo',
            count,
            fetch: (i) => service.dynamic!.getCombo(i),
            store: (i, e) => service.dynamic!.setCombo(i, e),
            isEmpty: (e) => e.keys.every((k) => !k) && !e.output,
            blank: () => ({ keys: [0, 0, 0, 0], output: 0 }),
        }),
        [service, count],
    )
    const table = useEntryTable(spec, opened)
    return <EntryTable table={table} columns={COLUMNS} />
}
