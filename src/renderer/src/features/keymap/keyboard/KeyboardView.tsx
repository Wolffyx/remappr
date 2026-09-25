// pattern-check: skip — orchestration shell after extracting stage logic into hooks; no new abstraction
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { KeyAction, Keymap } from '@firmware/types'
import { type KeyPosition, PhysicalLayoutCanvas } from './PhysicalLayoutCanvas'
import { KeyContextMenu } from './KeyContextMenu'
import { LayerColorRail } from './LayerColorRail'
import { CommandAssign } from './CommandAssign'
import {
    type KeyActionDraft,
    KeyActionPicker,
} from '@/features/actions/KeyActionPicker'
import { Modal } from '@/ui/modal'
import type { WorkspaceMode } from '@/stores/userSettingsStore'
import type { CatalogEntry } from '@firmware/catalog/types'
import { useLayout } from '@/hooks/use-layouts'
import useConnectionStore from '@/stores/connectionStore'
import useLayerSelectionStore from '@/stores/layerSelectionStore'
import useHeatmapStore from '@/stores/heatmapStore'
import useLiveViewStore from '@/stores/liveViewStore'
import useKeyTestStore from '@/stores/keyTestStore'
import useLayerPeekStore from '@/stores/layerPeekStore'
import type { EncoderSelection } from '@/features/encoders/model'
import { useActionTypes } from './stage/useActionTypes'
import { useStageLighting } from './stage/useStageLighting'
import { useStageBindings } from './stage/useStageBindings'
import { useLivePresses } from './stage/useLivePresses'
import { useKeymapMutations } from './stage/useKeymapMutations'
import { useStageSelection } from './stage/useStageSelection'
import { useStageShortcuts } from './stage/useStageShortcuts'
import type { PaintApi } from './stage/usePerKeyPaint'
import { StageControls } from './stage/StageControls'
import { KeyTestPanel } from './stage/KeyTestPanel'
import {
    LayerPill,
    MultiSelectBar,
    PeekBanner,
    SelectedKeyCard,
} from './stage/StageOverlays'

interface KeyboardViewProps {
    keymap: Keymap | undefined
    selectedKeyPosition: number | undefined
    setSelectedKeyPosition: (position: number | undefined) => void
    selectedEncoder?: EncoderSelection | undefined
    setSelectedEncoder?: (sel: EncoderSelection | undefined) => void
    multiSelection: Set<number>
    setMultiSelection: (next: Set<number>) => void
    workspace: WorkspaceMode
    // Bottom-sheet picker visibility (workbench). Decoupled from selection so the
    // stage can show a floating selected-key card with an Edit button once closed.
    pickerOpen?: boolean
    setPickerOpen?: (open: boolean) => void
    // Pushes the resolved KeyPosition of the single selected key upward so the
    // inspector panel can render the design's selected-key summary card (which
    // needs the same tinted KeyButton preview the stage builds).
    onSelectedKeyInfoChange?: (info: KeyPosition | undefined) => void
    // Per-key RGB paint instance, lifted to KeymapEditor so the RGB bottom sheet
    // and the board share one (LED map, glow colours, coalesced writes).
    paint: PaintApi
    // RGB sheet per-key mode: clicks select keys for colour editing in the sheet,
    // so a single click must NOT also open the keymap binding picker.
    suppressPicker?: boolean
}

export default function KeyboardView({
    keymap,
    selectedKeyPosition,
    setSelectedKeyPosition,
    selectedEncoder,
    setSelectedEncoder,
    multiSelection,
    setMultiSelection,
    workspace,
    pickerOpen,
    setPickerOpen,
    onSelectedKeyInfoChange,
    paint,
    suppressPicker,
}: KeyboardViewProps): JSX.Element {
    const { layouts, selectedPhysicalLayoutIndex } = useLayout()
    // Per-field selectors (not whole-store reads) so this view — which owns the canvas
    // — doesn't re-render on unrelated store changes.
    const selectedLayerIndex = useLayerSelectionStore(
        (s) => s.selectedLayerIndex,
    )
    const setSelectedLayerIndex = useLayerSelectionStore(
        (s) => s.setSelectedLayerIndex,
    )
    const service = useConnectionStore((s) => s.service)
    const codec = useConnectionStore((s) => s.service?.codec)
    const peekLayerIndex = useLayerPeekStore((s) => s.peekLayerIndex)

    const effectiveLayerIndex = useMemo(() => {
        if (!keymap || keymap.layers.length === 0) return 0
        return Math.min(
            Math.max(0, selectedLayerIndex),
            keymap.layers.length - 1,
        )
    }, [keymap, selectedLayerIndex])

    useEffect(() => {
        // Feature 1: when the firmware drives a hardware default layer (e.g.
        // Keychron Mac/Win DIP), connectionStore seeds the selection — don't
        // clobber it here. Otherwise reset to layer 0 on device change.
        if (!service?.layerControl) setSelectedLayerIndex(0)
        setSelectedKeyPosition(undefined)
    }, [service, setSelectedLayerIndex, setSelectedKeyPosition])

    // Layer rendered on the stage: the hover-peeked layer if any, else the real selection.
    const displayLayerIndex = useMemo(() => {
        if (peekLayerIndex == null || !keymap) return effectiveLayerIndex
        return Math.min(Math.max(0, peekLayerIndex), keymap.layers.length - 1)
    }, [peekLayerIndex, keymap, effectiveLayerIndex])
    const isPeeking =
        peekLayerIndex != null && displayLayerIndex !== effectiveLayerIndex

    const actionTypes = useActionTypes(service)

    const heatmapEnabled = useHeatmapStore((s) => s.enabled)
    const heatmapCounts = useHeatmapStore((s) => s.counts)
    const resetHeat = useHeatmapStore((s) => s.reset)
    const liveView = useLiveViewStore((s) => s.enabled)
    const keyTestActive = useKeyTestStore((s) => s.active)
    const keyTestSeen = useKeyTestStore((s) => s.seen)
    const resetKeyTest = useKeyTestStore((s) => s.reset)

    // RGB-simulation glow (device-derived when connected, else manual sim store).
    const lighting = useStageLighting(service)

    // Resolved key positions (legends + categories + encoders + heatmap tint).
    const positions = useStageBindings({
        layouts,
        keymap,
        selectedPhysicalLayoutIndex,
        displayLayerIndex,
        heatmapEnabled,
        heatmapCounts,
    })

    // Live-view pressed keys (also drives heatmap counting).
    const pressedKeys = useLivePresses({
        layouts,
        keymap,
        effectiveLayerIndex,
        selectedPhysicalLayoutIndex,
        service,
        keyTestActive,
    })
    const EMPTY_KEYS = useMemo(() => new Set<number>(), [])

    // Keymap mutations (single/multi set, copy/paste) — each one undo step.
    const { dispatchSetKeys, handleCopy, handlePaste, clipboardAction } =
        useKeymapMutations({ service, keymap, effectiveLayerIndex })

    // Orchestration state: assign-to-many modal + command palette + context menu.
    const [assignOpen, setAssignOpen] = useState(false)
    const [paletteOpen, setPaletteOpen] = useState(false)
    const [contextMenu, setContextMenu] = useState<{
        position: number
        x: number
        y: number
    } | null>(null)

    const handlePositionContextMenu = useCallback(
        (position: number, coords: { x: number; y: number }): void => {
            setContextMenu({ position, x: coords.x, y: coords.y })
        },
        [],
    )

    // Stable encoder-click handler so PhysicalLayoutCanvas (memoized) isn't re-rendered
    // by a fresh closure on every KeyboardView render.
    const handleEncoderClicked = useCallback(
        (sel: EncoderSelection): void => {
            setSelectedEncoder?.(sel)
            if (workspace === 'command') setPaletteOpen(true)
            else setPickerOpen?.(true)
        },
        [setSelectedEncoder, workspace, setPickerOpen],
    )

    const keyCount = keymap?.layers[effectiveLayerIndex]?.keys.length ?? 0

    // Selection: click handling, target positions, clear-all.
    const {
        anchorRef,
        handlePositionClicked,
        targetPositions,
        clearSelection,
    } = useStageSelection({
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
    })

    // Action-type lookups used by the assign/clear glue + command palette.
    const transparentType = useMemo(
        () => actionTypes.find((t) => /transparent/i.test(t.displayName ?? '')),
        [actionTypes],
    )
    const keyPressType = useMemo(
        () =>
            actionTypes.find(
                (t) => t.slots.length === 1 && t.slots[0].kind === 'hid',
            ),
        [actionTypes],
    )

    const handleClearBindings = useCallback((): void => {
        if (!service || !transparentType || targetPositions.length === 0) return
        dispatchSetKeys(
            targetPositions,
            service.buildKeyAction(transparentType.id, []),
        )
    }, [service, transparentType, targetPositions, dispatchSetKeys])

    const handleAssign = useCallback(
        (draft: KeyActionDraft): void => {
            if (!service) return
            dispatchSetKeys(
                targetPositions,
                service.buildKeyAction(draft.kind, draft.params),
            )
            setAssignOpen(false)
        },
        [service, targetPositions, dispatchSetKeys],
    )

    // Build a KeyAction from a picked catalog entry and apply it to the targets.
    const handleAssignEntry = useCallback(
        (entry: CatalogEntry): void => {
            if (!service || targetPositions.length === 0) return
            const behaviorKind = entry.behaviorRef?.kind
            let action: KeyAction | null = null
            if (behaviorKind) {
                action = service.buildKeyAction(behaviorKind, [])
            } else if (keyPressType) {
                const enc = codec?.encode(entry.id)
                if (enc)
                    action = service.buildKeyAction(keyPressType.id, [
                        enc.value,
                    ])
            }
            if (action) dispatchSetKeys(targetPositions, action)
            setPaletteOpen(false)
        },
        [service, codec, keyPressType, targetPositions, dispatchSetKeys],
    )

    const assignSeed = useMemo(
        () =>
            targetPositions.length > 0
                ? (keymap?.layers[effectiveLayerIndex]?.keys[
                      targetPositions[0]
                  ] ?? null)
                : null,
        [targetPositions, keymap, effectiveLayerIndex],
    )

    const layerList = useMemo(
        () =>
            keymap?.layers.map(({ id, name }, li) => ({
                id,
                name: name || li.toLocaleString(),
            })) ?? [],
        [keymap],
    )

    useStageShortcuts({
        assignOpen,
        paletteOpen,
        workspace,
        targetPositions,
        selectedKeyPosition,
        multiSelection,
        positions,
        handleClearBindings,
        clearSelection,
        setSelectedKeyPosition,
        setAssignOpen,
        setPaletteOpen,
        anchorRef,
    })

    const layerName =
        keymap?.layers[displayLayerIndex]?.name || String(displayLayerIndex)

    // Resolved KeyPosition for the single selected key (no multi-select), reused
    // by the floating stage card and pushed up for the inspector's summary card.
    const selectedKeyInfo =
        selectedKeyPosition != null &&
        selectedKeyPosition < keyCount &&
        multiSelection.size === 0
            ? positions[selectedKeyPosition]
            : undefined

    // Mirror the selected-key info to the parent so the inspector panel can render
    // the same tinted preview without recomputing the (expensive) label nodes.
    useEffect(() => {
        onSelectedKeyInfoChange?.(selectedKeyInfo)
    }, [selectedKeyInfo, onSelectedKeyInfoChange])

    // Floating selected-key card: shown when a single key is selected but the
    // bottom picker is closed (workbench/command). Edit reopens the picker.
    const infoCardPos =
        selectedKeyInfo && !pickerOpen && workspace !== 'inspector'
            ? selectedKeyInfo
            : undefined

    if (!layouts || !keymap) return <></>

    return (
        <div
            data-coach="board"
            className="workbench-bg p-2 col-start-2 row-start-1 items-center justify-center relative min-w-0 flex h-full"
        >
            {/* Dotted workbench backdrop + soft radial glow is the .workbench-bg
                class (incl. its masked ::before dot grid), ported from the design. */}
            <PhysicalLayoutCanvas
                positions={positions}
                oneU={48}
                hoverZoom={true}
                zoom="auto"
                pannable
                tooltips
                lighting={lighting}
                perKeyColors={paint.perKeyColors}
                selectedPosition={selectedKeyPosition}
                selectedPositions={multiSelection}
                onPositionClicked={handlePositionClicked}
                selectedEncoder={selectedEncoder}
                onEncoderClicked={handleEncoderClicked}
                onPositionContextMenu={handlePositionContextMenu}
                pressedKeys={
                    liveView || keyTestActive ? pressedKeys : EMPTY_KEYS
                }
                seenKeys={keyTestActive ? keyTestSeen : EMPTY_KEYS}
            />

            <LayerPill
                displayLayerIndex={displayLayerIndex}
                layerName={layerName}
                liveView={liveView}
            />
            {isPeeking && (
                <PeekBanner
                    displayLayerIndex={displayLayerIndex}
                    layerName={layerName}
                />
            )}
            <StageControls
                heatmapEnabled={heatmapEnabled}
                onResetHeat={resetHeat}
            />
            {keyTestActive && (
                <KeyTestPanel
                    seenCount={keyTestSeen.size}
                    total={keyCount}
                    hardware={!!service?.keyTest}
                    onReset={resetKeyTest}
                />
            )}
            {infoCardPos && (
                <SelectedKeyCard
                    info={infoCardPos}
                    layerName={layerName}
                    onEdit={() => setPickerOpen?.(true)}
                />
            )}
            {multiSelection.size > 0 && (
                <MultiSelectBar
                    count={multiSelection.size}
                    onAssign={() => setAssignOpen(true)}
                    onClear={handleClearBindings}
                    clearDisabled={!transparentType}
                    onDismiss={clearSelection}
                />
            )}
            {assignSeed && (
                <Modal
                    opened={assignOpen}
                    onClose={() => setAssignOpen(false)}
                    title={`Assign to ${targetPositions.length} ${
                        targetPositions.length === 1 ? 'key' : 'keys'
                    }`}
                    xButton={true}
                    isDismissable={true}
                    showFooter={false}
                >
                    <KeyActionPicker
                        action={assignSeed}
                        actionTypes={actionTypes}
                        layers={layerList}
                        onChange={handleAssign}
                    />
                </Modal>
            )}
            {workspace === 'command' && (
                <>
                    <LayerColorRail />
                    <CommandAssign
                        open={paletteOpen}
                        onOpenChange={setPaletteOpen}
                        targetCount={targetPositions.length}
                        onSelect={handleAssignEntry}
                    />
                </>
            )}
            <KeyContextMenu
                open={contextMenu !== null}
                x={contextMenu?.x ?? 0}
                y={contextMenu?.y ?? 0}
                items={
                    contextMenu === null
                        ? []
                        : [
                              {
                                  label: 'Copy binding',
                                  onSelect: () =>
                                      handleCopy(contextMenu.position),
                              },
                              {
                                  label: clipboardAction
                                      ? 'Paste binding'
                                      : 'Paste binding (empty)',
                                  disabled: !clipboardAction,
                                  onSelect: () =>
                                      handlePaste(contextMenu.position),
                              },
                          ]
                }
                onClose={() => setContextMenu(null)}
            />
        </div>
    )
}
