import { Plus, Search, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { Keymap } from '@firmware/types'

import useLayerSelectionStore from '@/stores/layerSelectionStore'
import { SidebarGroupLabel, SidebarMenu } from '@/ui/sidebar'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/ui/tooltip'
import { useLayerActions } from '@/hooks/use-layer-actions'
import { useIndexShortcuts } from '@/features/sidebar/useIndexShortcuts'
import { useLayerDragReorder } from '@/hooks/use-layer-drag-reorder'

import { LayerListItem } from './LayerListItem'

interface Layer {
    id: number
    name?: string
}

export type LayerClickCallback = (index: number) => void
export type LayerMovedCallback = (index: number, destination: number) => void

// Pattern check: no GoF pattern (-) — rejected — header search toggle, scroll mode and ⌥ shortcuts added to the existing picker; small hook beside it.
interface LayerPickerProps {
    layers: Array<Layer>
    canAdd?: boolean
    canRemove?: boolean
    // Read-only (behind-dongle node) views pass false to hide every layer edit
    // (drag-reorder, rename, duplicate, delete). Defaults to editable.
    editable?: boolean
    /** The list scrolls in the space left (the sidebar's scrolling style). */
    scroll?: boolean
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
    scroll = false,
    onLayerClicked,
    setKeymap,
    keymap,
}: LayerPickerProps): JSX.Element => {
    const { selectedLayerIndex, setSelectedLayerIndex } =
        useLayerSelectionStore()
    const {
        add,
        duplicate,
        copyKeysFrom,
        remove,
        handleSaveNewLabel,
        selectionChanged,
    } = useLayerActions({ keymap, setKeymap })
    const { dragSourceIndex, dragOverIndex, handlersFor, move } =
        useLayerDragReorder({ setKeymap })
    const [query, setQuery] = useState<string | null>(null)
    const searchOpen = query !== null
    const searchRef = useRef<HTMLInputElement>(null)
    useEffect(() => {
        if (searchOpen) searchRef.current?.focus()
    }, [searchOpen])
    useIndexShortcuts(layers.length, selectedLayerIndex, setSelectedLayerIndex)

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

    const names = useMemo(() => layersArray.map((l) => l.name), [layersArray])
    const needle = query?.trim().toLowerCase() ?? ''
    const visible = needle
        ? layersArray.filter(
              (l) =>
                  l.name.toLowerCase().includes(needle) ||
                  String(l.index) === needle,
          )
        : layersArray
    const capacity = keymap ? layers.length + (keymap.availableLayers || 0) : 0

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
        <div className={scroll ? 'flex min-h-0 flex-1 flex-col' : undefined}>
            <div className="flex items-center gap-1.5 px-2 pb-1.5">
                <SidebarGroupLabel className="eyebrow h-auto p-0">
                    Layers
                </SidebarGroupLabel>
                {capacity > layers.length && (
                    <span className="text-caption text-muted-foreground">
                        {layers.length} / {capacity}
                    </span>
                )}
                <button
                    type="button"
                    onClick={() => setQuery(query === null ? '' : null)}
                    aria-label="Search layers"
                    aria-pressed={query !== null}
                    className="ml-auto grid size-[22px] place-items-center rounded-sm text-muted-foreground hover:bg-sidebar-accent hover:text-foreground aria-pressed:text-primary"
                >
                    <Search className="size-3.5" />
                </button>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <button
                            type="button"
                            onClick={add}
                            disabled={!canAdd}
                            aria-label="Add layer"
                            className="grid size-[22px] place-items-center rounded-sm text-muted-foreground hover:bg-sidebar-accent hover:text-foreground disabled:opacity-40"
                        >
                            <Plus className="size-4" />
                        </button>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>Add layer</p>
                    </TooltipContent>
                </Tooltip>
            </div>
            {query !== null && (
                <label className="mx-0.5 mb-1.5 flex h-[30px] items-center gap-1.5 rounded-md border border-primary/45 bg-background px-2 text-muted-foreground">
                    <Search className="size-3.5 shrink-0" />
                    <input
                        ref={searchRef}
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Escape') setQuery(null)
                            if (e.key === 'Enter' && visible[0])
                                selectionChanged(visible[0].index)
                        }}
                        placeholder="Search layers"
                        aria-label="Search layers"
                        className="min-w-0 flex-1 bg-transparent text-control text-foreground outline-none"
                    />
                    {needle && (
                        <span className="shrink-0 text-caption">
                            {visible.length} of {layers.length}
                        </span>
                    )}
                    <button
                        type="button"
                        onClick={() => setQuery(null)}
                        aria-label="Close search"
                        className="grid size-5 place-items-center rounded-sm hover:text-foreground"
                    >
                        <X className="size-3.5" />
                    </button>
                </label>
            )}
            <SidebarMenu
                className={
                    scroll
                        ? 'min-h-0 flex-1 gap-[3px] overflow-y-auto'
                        : 'gap-[3px]'
                }
            >
                {visible.map((item) => (
                    <LayerListItem
                        key={item.id ?? item.index}
                        item={item}
                        selectedLayerIndex={selectedLayerIndex}
                        count={layers.length}
                        names={names}
                        canRemove={canRemove}
                        editable={editable}
                        dragHandlers={
                            editable && !needle
                                ? handlersFor(item.index)
                                : undefined
                        }
                        isDragSource={dragSourceIndex === item.index}
                        isDragOver={dragOverIndex === item.index}
                        onSelect={(idx) => {
                            selectionChanged(idx)
                            onLayerClicked?.(idx)
                        }}
                        onRemove={remove}
                        onDuplicate={duplicate}
                        onMove={move}
                        onCopyFrom={copyKeysFrom}
                        onSaveNewLabel={handleSaveNewLabel}
                    />
                ))}
            </SidebarMenu>
            {!scroll && (
                <button
                    type="button"
                    onClick={add}
                    disabled={!canAdd}
                    className="mt-1 flex w-full items-center gap-2 rounded-md border border-dashed border-sidebar-border px-2.5 py-2 text-panel-title font-semibold text-muted-foreground transition-colors hover:border-primary hover:text-foreground disabled:cursor-default disabled:opacity-40 disabled:hover:border-sidebar-border disabled:hover:text-muted-foreground"
                >
                    <Plus className="size-4" /> Add layer
                </button>
            )}
        </div>
    )
}
