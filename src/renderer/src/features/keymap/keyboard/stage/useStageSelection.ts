// pattern-check: skip — selection state/handlers extracted from KeyboardView
import { useCallback, useMemo, useRef } from 'react'
import type { WorkspaceMode } from '@/stores/userSettingsStore'
import type { ClickModifiers } from '../PhysicalLayoutCanvas'
import type { EncoderSelection } from '@/features/encoders/model'

interface Inputs {
    keyCount: number
    multiSelection: Set<number>
    selectedKeyPosition: number | undefined
    setSelectedKeyPosition: (position: number | undefined) => void
    setMultiSelection: (next: Set<number>) => void
    setSelectedEncoder?: (sel: EncoderSelection | undefined) => void
    workspace: WorkspaceMode
    setPickerOpen?: (open: boolean) => void
    setPaletteOpen: (open: boolean) => void
    setAssignOpen: (open: boolean) => void
    // RGB sheet per-key mode: clicks still select (so the sheet can colour the key)
    // but must not open the keymap binding picker.
    suppressPicker?: boolean
}

interface Selection {
    anchorRef: React.MutableRefObject<number | null>
    handlePositionClicked: (position: number, mods?: ClickModifiers) => void
    targetPositions: number[]
    clearSelection: () => void
}

/** Single/multi key selection: click handling (range + toggle), the resolved
 *  target positions for bulk actions, and a clear-all. */
export function useStageSelection({
    keyCount,
    multiSelection,
    selectedKeyPosition,
    setSelectedKeyPosition,
    setMultiSelection,
    setSelectedEncoder,
    workspace,
    setPickerOpen,
    setPaletteOpen,
    setAssignOpen,
    suppressPicker,
}: Inputs): Selection {
    // Anchor for shift-range selection.
    const anchorRef = useRef<number | null>(null)

    // Single click selects (opens the inspector); ⌘/ctrl-click toggles and shift-click
    // ranges into a multi-selection. Multi and single selection are mutually exclusive.
    const handlePositionClicked = useCallback(
        (position: number, mods?: ClickModifiers): void => {
            if (position >= keyCount) {
                setSelectedKeyPosition(position)
                return
            }
            if (mods?.shiftKey && anchorRef.current != null) {
                const a = anchorRef.current
                const lo = Math.min(a, position)
                const hi = Math.max(a, position)
                const next = new Set(multiSelection)
                if (selectedKeyPosition != null) next.add(selectedKeyPosition)
                for (let i = lo; i <= hi; i++) if (i < keyCount) next.add(i)
                setSelectedKeyPosition(undefined)
                setMultiSelection(next)
            } else if (mods && (mods.metaKey || mods.ctrlKey)) {
                const next = new Set(multiSelection)
                if (selectedKeyPosition != null) next.add(selectedKeyPosition)
                if (next.has(position)) next.delete(position)
                else next.add(position)
                anchorRef.current = position
                setSelectedKeyPosition(undefined)
                setMultiSelection(next)
            } else {
                anchorRef.current = position
                if (multiSelection.size > 0) setMultiSelection(new Set())
                setSelectedKeyPosition(position)
                // Command workspace: clicking a key opens the assign palette.
                if (workspace === 'command') setPaletteOpen(true)
                // RGB sheet per-key mode: select only, the sheet edits the colour.
                else if (suppressPicker) {
                    /* no picker — selection drives the RGB sheet colour editor */
                }
                // Workbench/inspector: a click (re)opens the binding picker.
                else setPickerOpen?.(true)
            }
        },
        [
            keyCount,
            multiSelection,
            selectedKeyPosition,
            setSelectedKeyPosition,
            setMultiSelection,
            workspace,
            setPickerOpen,
            setPaletteOpen,
            suppressPicker,
        ],
    )

    // Positions a bulk action applies to: the multi-selection, else the single selection.
    const targetPositions = useMemo(() => {
        const list =
            multiSelection.size > 0
                ? [...multiSelection]
                : selectedKeyPosition != null
                  ? [selectedKeyPosition]
                  : []
        return list.filter((p) => p < keyCount)
    }, [multiSelection, selectedKeyPosition, keyCount])

    const clearSelection = useCallback((): void => {
        setMultiSelection(new Set())
        setSelectedKeyPosition(undefined)
        setSelectedEncoder?.(undefined)
        setAssignOpen(false)
        setPaletteOpen(false)
        // Drop DOM focus from the keycap; otherwise its focus ring lingers
        // and reads as a still-selected key after Escape.
        const active = document.activeElement as HTMLElement | null
        if (active?.closest('[data-key="true"]')) active.blur()
    }, [
        setMultiSelection,
        setSelectedKeyPosition,
        setSelectedEncoder,
        setAssignOpen,
        setPaletteOpen,
    ])

    return { anchorRef, handlePositionClicked, targetPositions, clearSelection }
}
