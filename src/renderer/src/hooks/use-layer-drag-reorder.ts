// pattern-check: skip mechanical port — uses service.moveLayer + neutral Keymap mutation
import { useCallback, useRef, useState } from 'react'
import type { Keymap } from '@firmware/types'
import type { KeyboardService } from '@firmware/service'
import undoRedoStore from '@/stores/undoRedoStore'
import useConnectionStore from '@/stores/connectionStore'
import useLayerSelectionStore from '@/stores/layerSelectionStore'

async function moveLayerOp(
    service: KeyboardService,
    setKeymap: (updater: (draft: Keymap) => void) => void,
    setSelectedLayerIndex: (i: number) => void,
    startIndex: number,
    destIndex: number,
): Promise<void> {
    await service.moveLayer(startIndex, destIndex)
    setKeymap((draft) => {
        const [moved] = draft.layers.splice(startIndex, 1)
        draft.layers.splice(destIndex, 0, moved)
    })
    setSelectedLayerIndex(destIndex)
}

export interface DragHandlers {
    draggable: boolean
    onDragStart: (e: React.DragEvent) => void
    onDragOver: (e: React.DragEvent) => void
    onDragEnter: () => void
    onDragLeave: () => void
    onDrop: (e: React.DragEvent) => void
    onDragEnd: () => void
}

interface UseLayerDragReorderArgs {
    setKeymap?: (updater: (draft: Keymap) => void) => void
}

interface UseLayerDragReorderResult {
    dragSourceIndex: number | null
    dragOverIndex: number | null
    handlersFor: (index: number) => DragHandlers
    /** Move a layer without a drag (menu Move up / Move down). */
    move: (start: number, dest: number) => void
}

export function useLayerDragReorder({
    setKeymap,
}: UseLayerDragReorderArgs): UseLayerDragReorderResult {
    // Field-scoped selectors — avoids re-rendering on unrelated store changes.
    const doIt = undoRedoStore((s) => s.doIt)
    const service = useConnectionStore((s) => s.service)
    const setSelectedLayerIndex = useLayerSelectionStore(
        (s) => s.setSelectedLayerIndex,
    )

    const sourceRef = useRef<number | null>(null)
    const [dragSourceIndex, setDragSourceIndex] = useState<number | null>(null)
    const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)

    const performMove = useCallback(
        (start: number, dest: number): void => {
            if (!service || !setKeymap) return
            if (start === dest) return
            doIt?.(async () => {
                try {
                    await moveLayerOp(
                        service,
                        setKeymap,
                        setSelectedLayerIndex,
                        start,
                        dest,
                    )
                } catch (e) {
                    console.error('Failed to move layer', e)
                }
                return async () => {
                    try {
                        await moveLayerOp(
                            service,
                            setKeymap,
                            setSelectedLayerIndex,
                            dest,
                            start,
                        )
                    } catch (e) {
                        console.error('Failed to undo move layer', e)
                    }
                }
            })
        },
        [service, doIt, setKeymap, setSelectedLayerIndex],
    )

    const handlersFor = useCallback(
        (index: number): DragHandlers => ({
            draggable: true,
            onDragStart: (e) => {
                sourceRef.current = index
                setDragSourceIndex(index)
                e.dataTransfer.effectAllowed = 'move'
                e.dataTransfer.setData('text/plain', String(index))
            },
            onDragOver: (e) => {
                if (sourceRef.current === null) return
                e.preventDefault()
                e.dataTransfer.dropEffect = 'move'
            },
            onDragEnter: () => {
                if (sourceRef.current === null) return
                setDragOverIndex(index)
            },
            onDragLeave: () => {
                setDragOverIndex((prev) => (prev === index ? null : prev))
            },
            onDrop: (e) => {
                e.preventDefault()
                const start = sourceRef.current
                sourceRef.current = null
                setDragSourceIndex(null)
                setDragOverIndex(null)
                if (start === null || start === index) return
                performMove(start, index)
            },
            onDragEnd: () => {
                sourceRef.current = null
                setDragSourceIndex(null)
                setDragOverIndex(null)
            },
        }),
        [performMove],
    )

    return { dragSourceIndex, dragOverIndex, handlersFor, move: performMove }
}
