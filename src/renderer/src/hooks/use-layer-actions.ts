// pattern-check: skip mechanical port — uses service.{addLayer,removeLayer,renameLayer,restoreLayer} and mutates neutral Keymap draft
import { useCallback } from 'react'
import { toast } from 'sonner'
import type { Keymap, Layer } from '@firmware/types'
import undoRedoStore from '@/stores/undoRedoStore'
import useConnectionStore from '@/stores/connectionStore'
import useLayerSelectionStore from '@/stores/layerSelectionStore'

interface UseLayerActionsArgs {
    keymap?: Keymap
    setKeymap?: (updater: (draft: Keymap) => void) => void
}

// pattern-check: skip — additive callback field on existing result interface
interface UseLayerActionsResult {
    add: () => void
    duplicate: (layerIndex: number) => void
    /** Overwrite every key of `targetIndex` with the keys of `sourceIndex`. */
    copyKeysFrom: (targetIndex: number, sourceIndex: number) => void
    remove: (layerIndex: number) => void
    changeLayerName: (id: number, oldName: string, newName: string) => void
    handleSaveNewLabel: (
        id: number,
        oldName: string,
        newName: string | null,
    ) => void
    selectionChanged: (layerIndex: number | string) => void
}

export function useLayerActions({
    keymap,
    setKeymap,
}: UseLayerActionsArgs): UseLayerActionsResult {
    // Field-scoped selectors — a bare store call re-renders every LayerPicker
    // host on unrelated store changes (undo/redo pushes, lock state…).
    const doIt = undoRedoStore((s) => s.doIt)
    const service = useConnectionStore((s) => s.service)
    const selectedLayerIndex = useLayerSelectionStore(
        (s) => s.selectedLayerIndex,
    )
    const setSelectedLayerIndex = useLayerSelectionStore(
        (s) => s.setSelectedLayerIndex,
    )

    const add = useCallback((): void => {
        if (!service || !setKeymap) return
        doIt?.(async () => {
            try {
                const newLayer = await service.addLayer()
                const insertIndex = keymap?.layers.length ?? 0
                setKeymap((draft) => {
                    draft.layers.push(newLayer)
                    draft.availableLayers--
                })
                setSelectedLayerIndex(insertIndex)
                return async () => {
                    try {
                        await service.removeLayer(newLayer.id)
                        setKeymap((draft) => {
                            const i = draft.layers.findIndex(
                                (l) => l.id === newLayer.id,
                            )
                            if (i >= 0) {
                                draft.layers.splice(i, 1)
                                draft.availableLayers++
                            }
                        })
                    } catch (e) {
                        console.error('Failed to undo addLayer', e)
                    }
                }
            } catch (e) {
                console.error('Failed to add layer', e)
                return async () => {}
            }
        })
    }, [service, doIt, keymap, setKeymap, setSelectedLayerIndex])

    // pattern-check: skip — additive callback mirroring add(); copies source bindings
    const duplicate = useCallback(
        (layerIndex: number): void => {
            if (!service || !setKeymap || !keymap) return
            const source = keymap.layers[layerIndex]
            if (!source) return
            const copyName = `${source.name} copy`
            const sourceKeys = source.keys.map((k) => ({ ...k }))
            doIt?.(async () => {
                try {
                    const newLayer = await service.addLayer()
                    if (sourceKeys.length) {
                        await service.setKeys(
                            sourceKeys.map((action, position) => ({
                                layerId: newLayer.id,
                                position,
                                action,
                            })),
                        )
                    }
                    try {
                        await service.renameLayer(newLayer.id, copyName)
                    } catch (e) {
                        console.error('Failed to name duplicated layer', e)
                    }
                    const insertIndex = keymap.layers.length
                    setKeymap((draft) => {
                        draft.layers.push({
                            ...newLayer,
                            name: copyName,
                            keys: sourceKeys,
                            encoders: source.encoders,
                        })
                        draft.availableLayers--
                    })
                    setSelectedLayerIndex(insertIndex)
                    return async () => {
                        try {
                            await service.removeLayer(newLayer.id)
                            setKeymap((draft) => {
                                const i = draft.layers.findIndex(
                                    (l) => l.id === newLayer.id,
                                )
                                if (i >= 0) {
                                    draft.layers.splice(i, 1)
                                    draft.availableLayers++
                                }
                            })
                        } catch (e) {
                            console.error('Failed to undo duplicate layer', e)
                        }
                    }
                } catch (e) {
                    console.error('Failed to duplicate layer', e)
                    return async () => {}
                }
            })
        },
        [service, doIt, keymap, setKeymap, setSelectedLayerIndex],
    )

    const remove = useCallback(
        (layerIndex: number): void => {
            if (!service || !setKeymap) return
            if (!keymap) {
                toast.error('No keymap loaded')
                return
            }
            const layerId = keymap.layers[layerIndex].id
            const currentLayersCount = keymap.layers.length

            doIt?.(async () => {
                try {
                    await service.removeLayer(layerId)
                    setKeymap((draft) => {
                        const i = draft.layers.findIndex(
                            (l) => l.id === layerId,
                        )
                        if (i >= 0) {
                            draft.layers.splice(i, 1)
                            draft.availableLayers++
                        }
                    })
                    if (selectedLayerIndex >= currentLayersCount - 1) {
                        setSelectedLayerIndex(
                            Math.max(0, currentLayersCount - 2),
                        )
                    } else if (selectedLayerIndex > layerIndex) {
                        setSelectedLayerIndex(selectedLayerIndex - 1)
                    }
                } catch (e) {
                    console.error('Failed to remove layer', e)
                }
                return async () => {
                    try {
                        const restored: Layer = await service.restoreLayer(
                            layerId,
                            layerIndex,
                        )
                        setKeymap((draft) => {
                            draft.layers.splice(layerIndex, 0, restored)
                            draft.availableLayers--
                        })
                        setSelectedLayerIndex(layerIndex)
                    } catch (e) {
                        console.error('Failed to undo remove layer', e)
                    }
                }
            })
        },
        [
            service,
            doIt,
            keymap,
            selectedLayerIndex,
            setKeymap,
            setSelectedLayerIndex,
        ],
    )

    const changeLayerName = useCallback(
        (id: number, oldName: string, newName: string): void => {
            if (!service || !setKeymap) return
            doIt?.(async () => {
                try {
                    await service.renameLayer(id, newName)
                    setKeymap((draft) => {
                        const layer = draft.layers.find((l) => l.id === id)
                        if (layer) layer.name = newName
                    })
                } catch (e) {
                    console.error('Failed to rename layer', e)
                }
                return async () => {
                    try {
                        await service.renameLayer(id, oldName)
                        setKeymap((draft) => {
                            const layer = draft.layers.find((l) => l.id === id)
                            if (layer) layer.name = oldName
                        })
                    } catch (e) {
                        console.error('Failed to undo rename layer', e)
                    }
                }
            })
        },
        [service, doIt, setKeymap],
    )

    const handleSaveNewLabel = useCallback(
        (id: number, oldName: string, newName: string | null): void => {
            if (newName !== null) changeLayerName(id, oldName, newName)
        },
        [changeLayerName],
    )

    const copyKeysFrom = useCallback(
        (targetIndex: number, sourceIndex: number): void => {
            if (!service || !setKeymap || !keymap) return
            const target = keymap.layers[targetIndex]
            const source = keymap.layers[sourceIndex]
            if (!target || !source || target === source) return
            const write = async (
                keys: Keymap['layers'][number]['keys'],
            ): Promise<void> => {
                await service.setKeys(
                    keys.map((action, position) => ({
                        layerId: target.id,
                        position,
                        action,
                    })),
                )
                setKeymap((draft) => {
                    const layer = draft.layers.find((l) => l.id === target.id)
                    if (layer) layer.keys = keys.map((k) => ({ ...k }))
                })
            }
            const before = target.keys.map((k) => ({ ...k }))
            const after = source.keys.map((k) => ({ ...k }))
            doIt?.(async () => {
                try {
                    await write(after)
                } catch (e) {
                    console.error('Failed to copy layer keys', e)
                    toast.error('Failed to copy the keys')
                    return async () => {}
                }
                return async () => {
                    try {
                        await write(before)
                    } catch (e) {
                        console.error('Failed to undo copy layer keys', e)
                    }
                }
            })
        },
        [service, doIt, keymap, setKeymap],
    )

    const selectionChanged = useCallback(
        (layerIndex: number | string): void => {
            if (layerIndex === 'all') return
            if (typeof layerIndex !== 'number') return
            const maxIndex = (keymap?.layers.length ?? 0) - 1
            if (maxIndex < 0) return
            const clampedIndex = Math.min(Math.max(0, layerIndex), maxIndex)
            setSelectedLayerIndex(clampedIndex)
        },
        [keymap?.layers.length, setSelectedLayerIndex],
    )

    return {
        add,
        duplicate,
        copyKeysFrom,
        remove,
        changeLayerName,
        handleSaveNewLabel,
        selectionChanged,
    }
}
