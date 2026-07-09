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
    dispatchSetKey: (position: number, action: KeyAction) => void
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
            doIt?.(async (): Promise<() => Promise<void>> => {
                try {
                    await service.setKey(layerId, position, action)
                    setKeymapInStore((prev) => {
                        if (!prev) return prev
                        return produce(prev, (d) => {
                            d.layers[layer].keys[position] = action
                        })
                    })
                } catch (e) {
                    toast.error('Failed to set action')
                    console.error('contextmenu setKey failed', e)
                }
                return async (): Promise<void> => {
                    try {
                        await service.setKey(layerId, position, oldAction)
                        setKeymapInStore((prev) => {
                            if (!prev) return prev
                            return produce(prev, (d) => {
                                d.layers[layer].keys[position] = oldAction
                            })
                        })
                    } catch (e) {
                        console.error('Failed to undo contextmenu setKey', e)
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
            doIt?.(async (): Promise<() => Promise<void>> => {
                try {
                    for (const p of positions) {
                        await service.setKey(layerId, p, action)
                    }
                    setKeymapInStore(
                        (prev) =>
                            prev &&
                            produce(prev, (d) => {
                                for (const p of positions)
                                    d.layers[layer].keys[p] = action
                            }),
                    )
                } catch (e) {
                    toast.error('Failed to set actions')
                    console.error('multi setKey failed', e)
                }
                return async (): Promise<void> => {
                    try {
                        for (const p of positions) {
                            const old = olds.get(p)
                            if (old) await service.setKey(layerId, p, old)
                        }
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
        dispatchSetKey,
        dispatchSetKeys,
        handleCopy,
        handlePaste,
        clipboardAction,
    }
}
