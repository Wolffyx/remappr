import { Plus } from 'lucide-react'
import { useEffect, useMemo, useRef } from 'react'
import type { Keymap } from '@firmware/types'

import useLayerSelectionStore from '@/stores/layerSelectionStore'
import {
    SidebarGroupAction,
    SidebarGroupLabel,
    SidebarMenu,
} from '@/ui/sidebar'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/ui/tooltip'
import { useLayerActions } from '@/hooks/use-layer-actions'
import { useLayerDragReorder } from '@/hooks/use-layer-drag-reorder'

import { LayerListItem } from './LayerListItem'

interface Layer {
    id: number
    name?: string
}

export type LayerClickCallback = (index: number) => void
export type LayerMovedCallback = (index: number, destination: number) => void

// pattern-check: skip — additive optional `editable` prop on existing props
interface LayerPickerProps {
    layers: Array<Layer>
    canAdd?: boolean
    canRemove?: boolean
    // Read-only (behind-dongle node) views pass false to hide every layer edit
    // (drag-reorder, rename, duplicate, delete). Defaults to editable.
    editable?: boolean
    onLayerClicked?: LayerClickCallback
    setKeymap?: (updater: (draft: Keymap) => void) => void
    keymap?: Keymap
    setSelectedKey?: (key: number | undefined) => void
}

export const LayerPicker = ({
    layers,
    canAdd,
    canRemove,
    editable = true,
    onLayerClicked,
    setKeymap,
    keymap,
}: LayerPickerProps): JSX.Element => {
    const { selectedLayerIndex, setSelectedLayerIndex } =
        useLayerSelectionStore()
    const { add, duplicate, remove, handleSaveNewLabel, selectionChanged } =
        useLayerActions({ keymap, setKeymap })
    const { dragSourceIndex, dragOverIndex, handlersFor } = useLayerDragReorder(
        { setKeymap },
    )

    const layersArray = useMemo(
        () =>
            layers.map((l, i) => ({
                name: l.name || i.toLocaleString(),
                id: l.id,
                index: i,
                selected: i === selectedLayerIndex,
            })),
        [layers, selectedLayerIndex],
    )

    const previousLengthRef = useRef<number>(layers?.length ?? 0)
    useEffect(() => {
        const currentLength = layers?.length ?? 0
        const previousLength = previousLengthRef.current

        const awaitingNewLayer =
            selectedLayerIndex === previousLength &&
            currentLength === previousLength

        if (
            currentLength > 0 &&
            selectedLayerIndex >= currentLength &&
            !awaitingNewLayer
        ) {
            setSelectedLayerIndex(currentLength - 1)
        }
        if (selectedLayerIndex < 0) {
            setSelectedLayerIndex(0)
        }
        previousLengthRef.current = currentLength
    }, [layers?.length, selectedLayerIndex, setSelectedLayerIndex])

    return (
        <>
            <SidebarGroupLabel className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
                Layers
            </SidebarGroupLabel>
            <SidebarGroupAction
                title="Add Layer"
                onClick={add}
                disabled={!canAdd}
            >
                <Tooltip>
                    <TooltipTrigger asChild>
                        <span>
                            <Plus className="size-4" />
                        </span>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>Add Layer</p>
                    </TooltipContent>
                </Tooltip>
            </SidebarGroupAction>
            <SidebarMenu className="gap-[3px]">
                {layersArray.map((item) => (
                    <LayerListItem
                        key={item.id ?? item.index}
                        item={item}
                        selectedLayerIndex={selectedLayerIndex}
                        canRemove={canRemove}
                        editable={editable}
                        dragHandlers={
                            editable ? handlersFor(item.index) : undefined
                        }
                        isDragSource={dragSourceIndex === item.index}
                        isDragOver={dragOverIndex === item.index}
                        onSelect={(idx) => {
                            selectionChanged(idx)
                            onLayerClicked?.(idx)
                        }}
                        onRemove={remove}
                        onDuplicate={duplicate}
                        onSaveNewLabel={handleSaveNewLabel}
                    />
                ))}
            </SidebarMenu>
            {/* Dashed add-layer affordance, matching the design's list footer. */}
            <button
                type="button"
                onClick={add}
                disabled={!canAdd}
                className="mt-1 flex w-full items-center gap-2 rounded-[9px] border border-dashed border-sidebar-border px-2.5 py-2 text-[13px] font-semibold text-muted-foreground transition-colors hover:border-primary hover:text-foreground disabled:cursor-default disabled:opacity-40 disabled:hover:border-sidebar-border disabled:hover:text-muted-foreground"
            >
                <Plus className="size-4" /> Add layer
            </button>
        </>
    )
}
