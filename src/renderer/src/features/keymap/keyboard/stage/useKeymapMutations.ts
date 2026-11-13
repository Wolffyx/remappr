// pattern-check: skip — keymap mutation/undo + clipboard handlers extracted from KeyboardView
import { useCallback } from 'react'
import { produce } from 'immer'
import { toast } from 'sonner'
import type { KeyAction, Keymap } from '@firmware/types'
import type { KeyboardService } from '@firmware/service'
import useKeymapStore from '@/stores/keymapStore'
import useClipboardStore from '@/stores/clipboardStore'
import undoRedoStore from '@/stores/undoRedoStore'

interface Inputs {
    service: KeyboardService | null
    keymap: Keymap | undefined
    effectiveLayerIndex: number
}

interface Mutations {
    dispatchSetKeys: (positions: number[], action: KeyAction) => void
    handleCopy: (position: number) => void
    handlePaste: (position: number) => void
    clipboardAction: KeyAction | null
}

/** Single- and multi-key set/clear dispatch (each wrapped as one undo step) plus
 *  the right-click copy/paste handlers. */
export function useKeymapMutations({
    service,
    keymap,
    effectiveLayerIndex,
}: Inputs): Mutations {
    const setKeymapInStore = useKeymapStore((s) => s.setKeymap)
    const clipboardAction = useClipboardStore((s) => s.action)
    const setClipboardAction = useClipboardStore((s) => s.setAction)
    const doIt = undoRedoStore((s) => s.doIt)

    const dispatchSetKey = useCallback(
        (position: number, action: KeyAction): void => {
            if (!service || service.capabilities.readOnly || !keymap) return
            const layer = effectiveLayerIndex
            const layerEntry = keymap.layers[layer]
            if (!layerEntry) return
            const layerId = layerEntry.id
            const oldAction = layerEntry.keys[position]
            // pattern-check: skip — optimistic reorder of existing store write vs RPC, no abstraction
            const applyToStore = (a: KeyAction): void =>
                setKeymapInStore((prev) => {
                    if (!prev) return prev
                    return produce(prev, (d) => {
                        d.layers[layer].keys[position] = a
                    })
                })
            doIt?.(async (): Promise<() => Promise<void>> => {
                // Optimistic: store first, RPC after; revert + rethrow on
                // failure so no undo entry is pushed.
                applyToStore(action)
                try {
                    await service.setKey(layerId, position, action)
                } catch (e) {
                    toast.error('Failed to set action')
                    console.error('contextmenu setKey failed', e)
                    applyToStore(oldAction)
                    throw e
                }
                return async (): Promise<void> => {
                    applyToStore(oldAction)
                    try {
                        await service.setKey(layerId, position, oldAction)
                    } catch (e) {
                        console.error('Failed to undo contextmenu setKey', e)
                        applyToStore(action)
                    }
                }
            })
        },
        [service, keymap, effectiveLayerIndex, doIt, setKeymapInStore],
    )

    const dispatchSetKeys = useCallback(
        (positions: number[], action: KeyAction): void => {
            if (
                !service ||
                service.capabilities.readOnly ||
                !keymap ||
                positions.length === 0
            )
                return
            const layer = effectiveLayerIndex
            const layerEntry = keymap.layers[layer]
            if (!layerEntry) return
            const layerId = layerEntry.id
            const olds = new Map(positions.map((p) => [p, layerEntry.keys[p]]))
            // pattern-check: skip — optimistic reorder of existing store write vs RPC, no abstraction
            const applyAll = (a: KeyAction): void =>
                setKeymapInStore(
                    (prev) =>
                        prev &&
                        produce(prev, (d) => {
                            for (const p of positions)
                                d.layers[layer].keys[p] = a
                        }),
                )
            const applyOlds = (): void =>
                setKeymapInStore(
                    (prev) =>
                        prev &&
                        produce(prev, (d) => {
                            for (const p of positions) {
                                const old = olds.get(p)
                                if (old) d.layers[layer].keys[p] = old
                            }
                        }),
                )
            doIt?.(async (): Promise<() => Promise<void>> => {
                // Optimistic: store first, RPCs after; revert + rethrow on
                // failure so no undo entry is pushed. setKeys (not a setKey
                // loop) lets the save-mode controller stage the batch in one
                // op and batch-capable firmwares send one write.
                applyAll(action)
                try {
                    await service.setKeys(
                        positions.map((p) => ({
                            layerId,
                            position: p,
                            action,
                        })),
                    )
                } catch (e) {
                    toast.error('Failed to set actions')
                    console.error('multi setKey failed', e)
                    applyOlds()
                    throw e
                }
                return async (): Promise<void> => {
                    applyOlds()
                    try {
                        await service.setKeys(
                            positions.flatMap((p) => {
                                const old = olds.get(p)
                                return old
                                    ? [{ layerId, position: p, action: old }]
                                    : []
                            }),
                        )
                    } catch (e) {
                        console.error('Failed to undo multi setKey', e)
                    }
                }
            })
        },
        [service, keymap, effectiveLayerIndex, doIt, setKeymapInStore],
    )

    const handleCopy = useCallback(
        (position: number): void => {
            const action = keymap?.layers[effectiveLayerIndex]?.keys[position]
            if (action) {
                setClipboardAction(action)
                toast.success('Binding copied')
            }
        },
        [keymap, effectiveLayerIndex, setClipboardAction],
    )

    const handlePaste = useCallback(
        (position: number): void => {
            if (!clipboardAction) return
            dispatchSetKey(position, clipboardAction)
        },
        [clipboardAction, dispatchSetKey],
    )

    return {
        dispatchSetKeys,
        handleCopy,
        handlePaste,
        clipboardAction,
    }
}
