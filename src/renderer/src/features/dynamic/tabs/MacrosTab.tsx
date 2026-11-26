// Pattern check: no GoF pattern (-) — rejected — tab orchestration: data loading + per-macro edit buffer, composing the new presentational pieces.
//
// The Macros tab: a searchable list of every macro on the left, the selected
// macro's steps in the middle and the selected step on the right. Every macro is
// read once on open (summaries, "Run macro" previews); edits are kept per macro
// until saved or discarded.
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'

import {
    describeMacro,
    type KeyboardService,
    type MacroAction,
} from '@firmware'
import type { BehaviorRef, Keymap } from '@firmware/types'
import { saveWithToast } from '@/lib/saveWithToast'
import useKeymapStore from '@/stores/keymapStore'

import { MacroEditor } from './macros/MacroEditor'
import { MacroList, type MacroListItem } from './macros/MacroList'
import { BASIC_MACRO_KINDS, keyName } from './macros/macroSteps'

interface Props {
    service: KeyboardService
    opened: boolean
}

/** Every macro's steps, read once while the tab is open. */
function useAllMacros(
    service: KeyboardService,
    count: number,
    opened: boolean,
): [
    MacroAction[][] | null,
    React.Dispatch<React.SetStateAction<MacroAction[][] | null>>,
] {
    const [all, setAll] = useState<MacroAction[][] | null>(null)
    useEffect(() => {
        const api = service.macros
        if (!opened || !api) return
        let live = true
        Promise.all(Array.from({ length: count }, (_, i) => api.getMacro(i)))
            .then((list) => live && setAll(list))
            .catch((e) => {
                console.error(e)
                toast.error('Failed to load macros')
            })
        return () => {
            live = false
        }
    }, [service, count, opened])
    return [all, setAll]
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

export function MacrosTab({ service, opened }: Props): JSX.Element | null {
    const api = service.macros
    const count = api?.getCount() ?? 0
    const [idx, setIdx] = useState(0)
    const [all, setAll] = useAllMacros(service, count, opened)
    const [edits, setEdits] = useState<Record<number, MacroAction[]>>({})
    const keymap = useKeymapStore((s) => s.keymap)

    const names = useMemo(
        () =>
            api?.listNames?.() ??
            Array.from({ length: count }, (_, i) => `Macro ${i}`),
        [api, count],
    )
    const summaries = useMemo(
        () =>
            new Map(
                names.map((n, i) => [
                    n,
                    all ? describeMacro(all[i] ?? [], keyName) : '',
                ]),
            ),
        [names, all],
    )

    if (!api || count === 0) return null

    const items: MacroListItem[] = names.map((name, i) => ({
        name,
        summary: summaries.get(name) ?? '',
        used: usedOn(keymap, api.macroRef?.(i)),
    }))
    const saved = all?.[idx]
    const steps = edits[idx] ?? saved
    const writable = !api.readonly && !!api.setMacro
    const dirty =
        edits[idx] !== undefined &&
        JSON.stringify(edits[idx]) !== JSON.stringify(saved)

    const dropEdit = (): void =>
        setEdits((prev) => {
            const next = { ...prev }
            delete next[idx]
            return next
        })

    const save = async (): Promise<void> => {
        const draft = edits[idx]
        const setMacro = api.setMacro
        if (!draft || !setMacro) return
        const ok = await saveWithToast(
            async () => {
                await setMacro(idx, draft)
                return true
            },
            `${names[idx]} saved`,
            'Failed to save macro',
        )
        if (!ok) return
        setAll((prev) => prev && prev.map((m, i) => (i === idx ? draft : m)))
        dropEdit()
    }

    return (
        <div className="-m-4 grid h-[40vh] min-h-80 grid-cols-[15rem_minmax(0,1fr)_19rem]">
            <MacroList
                items={items}
                selected={idx}
                usedCount={all ? all.filter((m) => m.length > 0).length : count}
                onSelect={setIdx}
            />
            {steps ? (
                <MacroEditor
                    key={idx}
                    name={names[idx]}
                    description={api.description?.(idx)}
                    used={items[idx].used}
                    steps={steps}
                    setSteps={(update) =>
                        setEdits((prev) => ({
                            ...prev,
                            [idx]: update(prev[idx] ?? saved ?? []),
                        }))
                    }
                    writable={writable}
                    blocked={api.editBlockedReason?.(idx) ?? null}
                    kinds={api.actionKinds ?? BASIC_MACRO_KINDS}
                    choices={{
                        allowed:
                            api.callTargets?.(idx) ??
                            names.filter((_, i) => i !== idx),
                        excluded: api.excludedCallTargets?.(idx) ?? [
                            { macro: names[idx], reason: 'is this macro.' },
                        ],
                        summaries,
                    }}
                    dirty={dirty}
                    onSave={() => void save()}
                    onDiscard={dropEdit}
                />
            ) : (
                <p className="col-span-2 p-5 text-sm text-muted-foreground">
                    Loading…
                </p>
            )}
        </div>
    )
}
