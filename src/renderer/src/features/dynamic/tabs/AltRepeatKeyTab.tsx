// pattern-check: skip — section spec + columns for the shared EntryTable
import { useMemo } from 'react'

import type {
    AltRepeatKeyEntry,
    AltRepeatKeyOptions,
    KeyboardService,
} from '@firmware'
import { Checkbox } from '@/ui/checkbox'

import { HexChip } from '../_shared/EntryCard'
import { EntryTable, type EntryColumn } from '../_shared/EntryTable'
import type { EntrySpec } from '../_shared/entryTable'
import { OptionGrid, type OptionDef } from '../_shared/OptionGrid'
import { useEntryTable } from '../_shared/useEntryTable'

interface Props {
    service: KeyboardService
    opened: boolean
}

// Vial soft cap — protocol exposes no per-firmware count for ARK.
export const ARK_MAX = 31

// `enabled` has its own column; the rest open under the row.
const ARK_OPTIONS: ReadonlyArray<OptionDef<keyof AltRepeatKeyOptions>> = [
    { key: 'defaultToThisAltKey', label: 'Default to alt' },
    { key: 'bidirectional', label: 'Bidirectional' },
    { key: 'ignoreModHandedness', label: 'Ignore handedness' },
]

type HexField = 'keycode' | 'altKeycode' | 'allowedMods'

const hexColumn = (
    id: HexField,
    header: string,
    mask?: number,
): EntryColumn<AltRepeatKeyEntry> => ({
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

const COLUMNS: readonly EntryColumn<AltRepeatKeyEntry>[] = [
    hexColumn('keycode', 'After key'),
    hexColumn('altKeycode', 'Repeat sends'),
    hexColumn('allowedMods', 'Allowed mods', 0xff),
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

export function AltRepeatKeyTab({ service, opened }: Props): JSX.Element {
    const spec = useMemo<EntrySpec<AltRepeatKeyEntry>>(
        () => ({
            noun: 'alt repeat',
            count: ARK_MAX + 1,
            fetch: (i) => service.dynamic!.getAltRepeatKey!(i),
            store: (i, e) => service.dynamic!.setAltRepeatKey!(i, e),
            isEmpty: (e) => !e.keycode && !e.altKeycode,
            blank: () => ({
                keycode: 0,
                altKeycode: 0,
                allowedMods: 0,
                options: {
                    defaultToThisAltKey: false,
                    bidirectional: false,
                    ignoreModHandedness: false,
                    enabled: false,
                },
            }),
        }),
        [service],
    )
    const table = useEntryTable(spec, opened)
    return (
        <div className="space-y-2">
            <p className="px-3 text-caption text-muted-foreground">
                Alternate Repeat sends a different key when you repeat the last
                keypress — e.g. after “a”, repeat emits “o”.
            </p>
            <EntryTable
                table={table}
                columns={COLUMNS}
                detail={(entry, set) => (
                    <OptionGrid
                        options={ARK_OPTIONS}
                        value={entry.options}
                        columns={3}
                        onChange={(k, v) =>
                            set((p) => ({
                                ...p,
                                options: { ...p.options, [k]: v },
                            }))
                        }
                    />
                )}
            />
        </div>
    )
}
