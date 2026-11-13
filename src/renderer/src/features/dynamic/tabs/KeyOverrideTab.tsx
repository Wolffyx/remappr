// pattern-check: skip — section spec + columns for the shared EntryTable
import { useMemo } from 'react'

import type {
    KeyboardService,
    KeyOverrideEntry,
    KeyOverrideOptions,
} from '@firmware'
import { Checkbox } from '@/ui/checkbox'

import { HexChip, Pair } from '../_shared/EntryCard'
import { EntryTable, type EntryColumn } from '../_shared/EntryTable'
import type { EntrySpec } from '../_shared/entryTable'
import { OptionGrid, type OptionDef } from '../_shared/OptionGrid'
import { useEntryTable } from '../_shared/useEntryTable'

interface Props {
    service: KeyboardService
    count: number
    opened: boolean
}

// `enabled` has its own column; the rest open under the row.
const KEY_OVERRIDE_OPTIONS: ReadonlyArray<OptionDef<keyof KeyOverrideOptions>> =
    [
        { key: 'activationTriggerDown', label: 'Activate on trigger down' },
        { key: 'activationRequiredModDown', label: 'Required mod down' },
        { key: 'activationNegativeModUp', label: 'Negative mod up' },
        { key: 'oneMod', label: 'One mod' },
        { key: 'noReregisterTrigger', label: 'No re-register' },
        { key: 'noUnregisterOnOtherKeyDown', label: 'No unregister on other' },
    ]

type HexField = 'trigger' | 'triggerMods' | 'replacement'

const hexColumn = (
    id: HexField,
    header: string,
    mask?: number,
): EntryColumn<KeyOverrideEntry> => ({
    id,
    header,
    cell: (e, set) => (
        <HexChip
            value={e[id]}
            mask={mask}
            onChange={(v) => set((p) => ({ ...p, [id]: v }))}
        />
    ),
})

const COLUMNS: readonly EntryColumn<KeyOverrideEntry>[] = [
    hexColumn('trigger', 'When pressed'),
    hexColumn('triggerMods', 'With mods', 0xff),
    hexColumn('replacement', 'Sends instead'),
    {
        id: 'enabled',
        header: 'On',
        className: 'w-16',
        cell: (e, set) => (
            <Checkbox
                aria-label="Enabled"
                checked={e.options.enabled}
                onCheckedChange={(v) =>
                    set((p) => ({
                        ...p,
                        options: { ...p.options, enabled: v === true },
                    }))
                }
            />
        ),
    },
]

type MaskField = 'layers' | 'negativeModMask' | 'suppressedMods'

const MASKS: readonly { id: MaskField; label: string; mask?: number }[] = [
    { id: 'layers', label: 'Active on layers' },
    {
        id: 'negativeModMask',
        label: 'Not when these mods are held',
        mask: 0xff,
    },
    {
        id: 'suppressedMods',
        label: 'Hide these mods from the output',
        mask: 0xff,
    },
]

function Detail({
    entry,
    set,
}: {
    entry: KeyOverrideEntry
    set: (f: (p: KeyOverrideEntry) => KeyOverrideEntry) => void
}): JSX.Element {
    return (
        <div className="flex flex-wrap items-start gap-x-6 gap-y-3">
            {MASKS.map(({ id, label, mask }) => (
                <Pair key={id} label={label}>
                    <HexChip
                        value={entry[id]}
                        mask={mask}
                        onChange={(v) => set((p) => ({ ...p, [id]: v }))}
                    />
                </Pair>
            ))}
            <OptionGrid
                options={KEY_OVERRIDE_OPTIONS}
                value={entry.options}
                columns={3}
                onChange={(k, v) =>
                    set((p) => ({ ...p, options: { ...p.options, [k]: v } }))
                }
            />
        </div>
    )
}

export function KeyOverrideTab({ service, count, opened }: Props): JSX.Element {
    const spec = useMemo<EntrySpec<KeyOverrideEntry>>(
        () => ({
            noun: 'key override',
            count,
            fetch: (i) => service.dynamic!.getKeyOverride(i),
            store: (i, e) => service.dynamic!.setKeyOverride(i, e),
            isEmpty: (e) => !e.trigger && !e.replacement,
            blank: () => ({
                trigger: 0,
                replacement: 0,
                layers: 0xffff,
                triggerMods: 0,
                negativeModMask: 0,
                suppressedMods: 0,
                options: {
                    activationTriggerDown: false,
                    activationRequiredModDown: false,
                    activationNegativeModUp: false,
                    oneMod: false,
                    noReregisterTrigger: false,
                    noUnregisterOnOtherKeyDown: false,
                    enabled: false,
                },
            }),
        }),
        [service, count],
    )
    const table = useEntryTable(spec, opened)
    return (
        <EntryTable
            table={table}
            columns={COLUMNS}
            detail={(entry, set) => <Detail entry={entry} set={set} />}
        />
    )
}
