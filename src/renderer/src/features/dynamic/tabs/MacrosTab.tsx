// Pattern check: no GoF pattern (-) — rejected — tab body composing the existing useEntryTable state hook with the redesign's list/editor; EntrySpec Strategy already exists.
//
// The Macros tab: a searchable list of every macro in use on the left, the
// selected macro's steps in the middle and the selected step on the right. The
// slots load, keep drafts and save through the same useEntryTable state as the
// other dynamic-entry sections; Save and Discard sit in the dock header like
// theirs. The list is not an EntryTable: the steps need the room of a full
// editor beside it, not a row of cells.
import { useMemo, useState } from 'react'

import {
    describeMacro,
    type KeyboardService,
    type MacroAction,
    type MacroPlayMode,
} from '@firmware'
import type { BehaviorRef, Keymap } from '@firmware/types'
import useKeymapStore from '@/stores/keymapStore'
import { Button } from '@/ui/button'
import { DockActions } from '@/ui/dock-shell'

import type { EntrySpec } from '../_shared/entryTable'
import { useEntryTable } from '../_shared/useEntryTable'
import { MacroEditor } from './macros/MacroEditor'
import { MacroList, type MacroListItem } from './macros/MacroList'
import { BASIC_MACRO_KINDS, keyName } from './macros/macroSteps'

interface Props {
    service: KeyboardService
    opened: boolean
}

/** A macro as the tab edits it: its steps, and how it plays where the
 *  firmware lets each macro choose. */
interface Entry {
    steps: MacroAction[]
    mode?: MacroPlayMode
}

/** "base · key 14", "base · keys 3, 4, 5", "4 keys on 2 layers" or "Not on any
 *  key", from the keymap the app already holds; undefined when the firmware
 *  can't say which binding a macro is. */
function usedOn(
    keymap: Keymap | undefined,
    ref: BehaviorRef | undefined,
): string | undefined {
    if (!keymap || !ref) return undefined
    const params = ref.params ?? []
    const hits = keymap.layers.flatMap((layer) =>
        layer.keys.flatMap((k, i) =>
            k.kind === ref.kind &&
            k.params.length === params.length &&
            k.params.every((p, j) => p === params[j])
                ? [{ layer: layer.name || `Layer ${layer.id}`, key: i }]
                : [],
        ),
    )
    if (hits.length === 0) return 'Not on any key'
    const layers = new Set(hits.map((h) => h.layer))
    if (layers.size > 1) return `${hits.length} keys on ${layers.size} layers`
    const keys = hits.map((h) => h.key)
    return `${hits[0].layer} · ${keys.length > 1 ? 'keys' : 'key'} ${keys.join(', ')}`
}

const NOUN: Readonly<Record<string, string>> = {
    keyboard: 'keyboard',
    mouse: 'mouse',
}

export function MacrosTab({ service, opened }: Props): JSX.Element | null {
    const api = service.macros
    const count = api?.getCount() ?? 0
    // Editable only when the adapter is not view-only AND exposes a writer. ZMK
    // (compile-time macros) exposes `macros` with `readonly: true` and no
    // `setMacro`. Never gate on a firmware name.
    const writable = !!api && !api.readonly && !!api.setMacro
    const modes = api?.getPlayMode ? api.playModes : undefined
    const keymap = useKeymapStore((s) => s.keymap)
    const [picked, setPicked] = useState<number | null>(null)

    const spec = useMemo<EntrySpec<Entry>>(
        () => ({
            noun: 'macro',
            count,
            fetch: async (i) => {
                const macros = service.macros!
                const steps = await macros.getMacro(i)
                if (!modes || !macros.getPlayMode) return { steps }
                return { steps, mode: await macros.getPlayMode(i) }
            },
            store: writable
                ? (i, e) => service.macros!.setMacro!(i, e.steps, e.mode)
                : undefined,
            isEmpty: (e) => e.steps.length === 0,
            blank: () => ({ steps: [] }),
            name: (i) => service.macros?.listNames?.()[i],
        }),
        [service, count, writable, modes],
    )
    const table = useEntryTable(spec, opened)

    const nameOf = (i: number): string => spec.name?.(i) ?? `Macro ${i}`
    const summaries = new Map(
        Array.from({ length: table.count }, (_, i) => {
            const e = table.entry(i)
            return [
                nameOf(i),
                e ? describeMacro(e.steps, keyName) : '',
            ] as const
        }),
    )

    if (!api || count === 0) return null

    const idx =
        picked !== null && table.rows.includes(picked)
            ? picked
            : (table.rows[0] ?? null)
    const entry = idx === null ? undefined : table.entry(idx)
    const items: MacroListItem[] = table.rows.map((i) => ({
        idx: i,
        name: nameOf(i),
        summary: summaries.get(nameOf(i)) ?? '',
        used: usedOn(keymap, api.macroRef?.(i)),
        dirty: table.dirty.has(i),
    }))
    const select = (i: number): void => {
        // Keep the macro listed while it is open, even if its steps go.
        table.reveal(i)
        setPicked(i)
    }
    const dirty = table.dirty.size
    const noun = NOUN[service.kind ?? 'keyboard'] ?? 'device'

    return (
        <>
            {writable && (
                <DockActions>
                    {dirty > 0 && (
                        <span className="flex items-center gap-1.5 text-caption text-muted-foreground">
                            <span
                                aria-hidden
                                className="size-2 rounded-full bg-warning"
                            />
                            {dirty > 1
                                ? `${dirty} macros changed`
                                : 'Unsaved changes'}
                        </span>
                    )}
                    <Button
                        variant="outline"
                        size="sm"
                        disabled={dirty === 0}
                        onClick={table.discard}
                    >
                        Discard
                    </Button>
                    <Button
                        size="sm"
                        disabled={dirty === 0}
                        onClick={() => void table.save()}
                    >
                        Save to {noun}
                    </Button>
                </DockActions>
            )}
            {/* Fills the dock body (40vh at most), and stays inside the device
                editor's shorter dock (46% of the window, header included). */}
            <div className="-m-4 grid h-[min(40vh,calc(46vh-5rem))] min-h-72 grid-cols-[15rem_minmax(0,1fr)_19rem]">
                <MacroList
                    items={items}
                    selected={idx ?? -1}
                    usedCount={table.used}
                    slotCount={table.count}
                    onSelect={select}
                    onNew={
                        writable && table.nextFree !== null
                            ? () => {
                                  const at = table.reveal()
                                  if (at !== null) setPicked(at)
                              }
                            : undefined
                    }
                />
                {idx !== null && entry ? (
                    <MacroEditor
                        key={idx}
                        name={nameOf(idx)}
                        description={api.description?.(idx)}
                        used={items.find((it) => it.idx === idx)?.used}
                        steps={entry.steps}
                        setSteps={(update) =>
                            table.update(idx, (e) => ({
                                ...e,
                                steps: update(e.steps),
                            }))
                        }
                        writable={writable}
                        blocked={api.editBlockedReason?.(idx) ?? null}
                        kinds={api.actionKinds ?? BASIC_MACRO_KINDS}
                        choices={{
                            allowed:
                                api.callTargets?.(idx) ??
                                table.rows.filter((i) => i !== idx).map(nameOf),
                            excluded: api.excludedCallTargets?.(idx) ?? [
                                {
                                    macro: nameOf(idx),
                                    reason: 'is this macro.',
                                },
                            ],
                            summaries,
                        }}
                        deviceNoun={noun}
                        playMode={
                            modes?.length
                                ? {
                                      modes,
                                      mode: entry.mode ?? modes[0],
                                      onChange: (mode) =>
                                          table.update(idx, (e) => ({
                                              ...e,
                                              mode,
                                          })),
                                  }
                                : undefined
                        }
                    />
                ) : (
                    <p className="col-span-2 p-5 text-control text-muted-foreground">
                        {table.loading
                            ? 'Reading the macros…'
                            : table.failed
                              ? 'Couldn’t read the macros from the device.'
                              : 'No macros yet.'}
                    </p>
                )}
            </div>
        </>
    )
}
