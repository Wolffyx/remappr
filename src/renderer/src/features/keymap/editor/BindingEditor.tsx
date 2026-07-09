// pattern-check: skip mechanical port — bridges neutral KeyAction store with KeyActionPicker via service.listActionTypes/buildKeyAction
import { X } from 'lucide-react'
import {
    type KeyActionDraft,
    KeyActionPicker,
} from '@/features/actions/KeyActionPicker'
import {
    type CSSProperties,
    useCallback,
    useEffect,
    useMemo,
    useState,
} from 'react'
import undoRedoStore from '@/stores/undoRedoStore'
import useConnectionStore from '@/stores/connectionStore'
import useLayerSelectionStore from '@/stores/layerSelectionStore'
import { produce } from 'immer'
import type { ActionType, KeyAction, Keymap } from '@firmware/types'
import { Card, CardContent } from '@/ui/card'
import { Button } from '@/ui/button'
import { Modal } from '@/ui/modal'
import { TapDanceTab } from '@/features/dynamic/tabs/TapDanceTab'
import type { KeyPosition } from '@/features/keymap/keyboard/PhysicalLayoutCanvas'
import { SelectedKeyCard } from './BindingEditorSelectedKeyCard'
import { toast } from 'sonner'

const TAP_DANCE_KINDS: ReadonlySet<string> = new Set(['vial:tap-dance'])

interface EncoderSelection {
    slot: number
    dir: 'cw' | 'ccw'
}

// pattern-check: skip — additive optional variant prop on existing BindingEditor
interface BindingEditorProps {
    keymap: Keymap | undefined
    setKeymap: (
        keymap:
            | Keymap
            | undefined
            | ((prev: Keymap | undefined) => Keymap | undefined),
    ) => void
    selectedKeyPosition: number | undefined
    setSelectedKeyPosition: (position: number | undefined) => void
    selectedEncoder?: EncoderSelection | undefined
    setSelectedEncoder?: (sel: EncoderSelection | undefined) => void
    // 'sheet' = bottom card (workbench); 'panel' = persistent right column (inspector).
    variant?: 'sheet' | 'panel'
    // Sheet visibility is decoupled from selection: closing the sheet keeps the
    // key selected (the stage shows a floating info card with an Edit button).
    // Ignored by the 'panel' variant, which always reflects the selection.
    pickerOpen?: boolean
    setPickerOpen?: (open: boolean) => void
    // Resolved preview of the selected key (panel variant only): drives the
    // design's selected-key summary card at the top of the inspector.
    selectedKeyInfo?: KeyPosition | undefined
}

export function BindingEditor({
    keymap,
    setKeymap,
    selectedKeyPosition,
    setSelectedKeyPosition,
    selectedEncoder,
    setSelectedEncoder,
    variant = 'sheet',
    pickerOpen,
    setPickerOpen,
    selectedKeyInfo,
}: BindingEditorProps): JSX.Element {
    const doIt = undoRedoStore((s) => s.doIt)
    const { service } = useConnectionStore()
    // Read-only services (behind-dongle node views) serve reads but reject edits;
    // the picker is replaced with a notice and doUpdateAction no-ops.
    const readOnly = !!service?.capabilities.readOnly
    const { selectedLayerIndex } = useLayerSelectionStore()
    const [actionTypes, setActionTypes] = useState<ActionType[]>([])

    useEffect(() => {
        if (!service) {
            /* eslint-disable react-hooks/set-state-in-effect */
            setActionTypes([])
            /* eslint-enable react-hooks/set-state-in-effect */
            return
        }
        let cancelled = false
        service.listActionTypes().then((types) => {
            if (!cancelled) setActionTypes(types)
        })
        return (): void => {
            cancelled = true
        }
    }, [service])

    const effectiveLayerIndex = useMemo((): number => {
        if (!keymap || keymap.layers.length === 0) return 0
        return Math.min(
            Math.max(0, selectedLayerIndex),
            keymap.layers.length - 1,
        )
    }, [keymap, selectedLayerIndex])

    const doUpdateAction = useCallback(
        (draft: KeyActionDraft): void => {
            if (!service || service.capabilities.readOnly || !keymap) return

            const layer = effectiveLayerIndex
            const layerId = keymap.layers[layer].id
            const newAction = service.buildKeyAction(draft.kind, draft.params)

            // Encoder edit branch.
            if (selectedEncoder && service.encoders) {
                const { slot, dir } = selectedEncoder
                const enc = keymap.layers[layer].encoders?.[slot]
                if (!enc) return
                const oldAction = dir === 'cw' ? enc.cw : enc.ccw
                const direction: 0 | 1 = dir === 'cw' ? 0 : 1
                const setEncoder = service.encoders.setEncoder.bind(
                    service.encoders,
                )
                doIt?.(async (): Promise<() => Promise<void>> => {
                    try {
                        await setEncoder(layerId, slot, direction, newAction)
                        setKeymap((prev) => {
                            if (!prev) return prev
                            return produce(prev, (d) => {
                                const e = d.layers[layer].encoders?.[slot]
                                if (!e) return
                                if (dir === 'cw') e.cw = newAction
                                else e.ccw = newAction
                            })
                        })
                    } catch (e) {
                        toast.error('Failed to set encoder action')
                        console.error('Encoder set failed:', e)
                    }
                    return async (): Promise<void> => {
                        try {
                            await setEncoder(
                                layerId,
                                slot,
                                direction,
                                oldAction,
                            )
                            setKeymap((prev) => {
                                if (!prev) return prev
                                return produce(prev, (d) => {
                                    const e = d.layers[layer].encoders?.[slot]
                                    if (!e) return
                                    if (dir === 'cw') e.cw = oldAction
                                    else e.ccw = oldAction
                                })
                            })
                        } catch (e) {
                            console.error('Failed to undo encoder set', e)
                        }
                    }
                })
                return
            }

            if (selectedKeyPosition === undefined) {
                console.error('No selection target for action update')
                return
            }

            const keyPosition = selectedKeyPosition
            const oldAction = keymap.layers[layer].keys[keyPosition]

            doIt?.(async (): Promise<() => Promise<void>> => {
                try {
                    await service.setKey(layerId, keyPosition, newAction)
                    setKeymap(
                        (prev: Keymap | undefined): Keymap | undefined => {
                            if (!prev) return prev
                            return produce(prev, (draftKeymap) => {
                                draftKeymap.layers[layer].keys[keyPosition] =
                                    newAction
                            })
                        },
                    )
                } catch (e) {
                    toast.error('Failed to set action')
                    console.error('Failed action details:', {
                        layerId,
                        keyPosition,
                        draft,
                        error: e,
                        oldAction,
                    })
                }

                return async (): Promise<void> => {
                    if (!service) return
                    try {
                        await service.setKey(layerId, keyPosition, oldAction)
                        setKeymap(
                            (prev: Keymap | undefined): Keymap | undefined => {
                                if (!prev) return prev
                                return produce(prev, (draftKeymap) => {
                                    draftKeymap.layers[layer].keys[
                                        keyPosition
                                    ] = oldAction
                                })
                            },
                        )
                    } catch (e) {
                        console.error('Failed to undo set action', e)
                    }
                }
            })
        },
        [
            service,
            keymap,
            doIt,
            effectiveLayerIndex,
            selectedKeyPosition,
            selectedEncoder,
            setKeymap,
        ],
    )

    const selectedAction = useMemo((): KeyAction | null => {
        if (keymap == null || !keymap.layers[effectiveLayerIndex]) return null
        if (selectedEncoder) {
            const enc =
                keymap.layers[effectiveLayerIndex].encoders?.[
                    selectedEncoder.slot
                ]
            if (!enc) return null
            return selectedEncoder.dir === 'cw' ? enc.cw : enc.ccw
        }
        if (
            selectedKeyPosition == null ||
            selectedKeyPosition >=
                keymap.layers[effectiveLayerIndex].keys.length
        )
            return null
        return keymap.layers[effectiveLayerIndex].keys[selectedKeyPosition]
    }, [keymap, effectiveLayerIndex, selectedKeyPosition, selectedEncoder])

    const layerList = useMemo(
        () =>
            keymap?.layers.map(({ id, name }, li) => ({
                id,
                name: name || li.toLocaleString(),
            })) ?? [],
        [keymap],
    )

    const panelLayerName =
        keymap?.layers[effectiveLayerIndex]?.name || String(effectiveLayerIndex)

    // pattern-check: skip render branch + close helper, no abstraction warranted
    const hasSelection = selectedKeyPosition !== undefined || !!selectedEncoder
    // Panel (inspector) always mirrors the selection; the bottom sheet is gated
    // on pickerOpen so it can be dismissed without losing the selection.
    const open =
        variant === 'panel' ? hasSelection : hasSelection && !!pickerOpen
    const closeEditor = (): void => {
        if (variant === 'panel') {
            setSelectedKeyPosition(undefined)
            setSelectedEncoder?.(undefined)
        } else {
            // Keep the key selected; the stage's info card takes over.
            setPickerOpen?.(false)
        }
    }

    const [tapDanceEditOpen, setTapDanceEditOpen] = useState(false)
    const tapDanceCount = service?.dynamic?.getCounts()?.tapDance ?? 0
    const tapDanceIdx =
        selectedAction && TAP_DANCE_KINDS.has(selectedAction.kind)
            ? (selectedAction.params[0] ?? 0)
            : null
    const canEditTapDance =
        tapDanceIdx !== null && !!service && tapDanceCount > 0

    const editorBody = (
        <>
            {selectedEncoder && (
                <div className="text-xs text-muted-foreground mb-2">
                    Encoder {selectedEncoder.slot} —{' '}
                    {selectedEncoder.dir.toUpperCase()}
                </div>
            )}
            {readOnly ? (
                <div className="rounded-md border border-dashed border-border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
                    This keyboard is read-only — it’s a node behind a dongle.
                    Editing isn’t available yet.
                </div>
            ) : (
                <div className="flex flex-row gap-4 w-full">
                    {selectedAction && (
                        <KeyActionPicker
                            action={selectedAction}
                            actionTypes={actionTypes}
                            layers={layerList}
                            onChange={doUpdateAction}
                        />
                    )}
                </div>
            )}
            {!readOnly && canEditTapDance && (
                <div className="mt-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setTapDanceEditOpen(true)}
                    >
                        Edit tap-dance #{tapDanceIdx}…
                    </Button>
                </div>
            )}
        </>
    )

    return (
        <>
            {variant === 'panel' ? (
                <aside
                    className="flex w-80 min-h-0 shrink-0 flex-col self-stretch overflow-y-auto overflow-x-hidden border-l bg-card"
                    style={
                        {
                            // Disable the chip list's own scroll (inherited via CSS
                            // var) so the aside is the single scroller — no nested
                            // double scrollbar — and the list fills the panel.
                            '--kc-picker-max-h': 'none',
                        } as CSSProperties
                    }
                >
                    <div className="flex items-center justify-between border-b px-4 py-2">
                        <span className="text-sm font-semibold">Inspector</span>
                        {open && (
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0"
                                onClick={closeEditor}
                            >
                                <X className="h-4 w-4" />
                            </Button>
                        )}
                    </div>
                    <div className="min-w-0 p-4">
                        {open ? (
                            <>
                                {selectedKeyInfo && (
                                    <SelectedKeyCard
                                        info={selectedKeyInfo}
                                        layerName={panelLayerName}
                                    />
                                )}
                                {editorBody}
                            </>
                        ) : (
                            <p className="text-sm text-muted-foreground">
                                Select a key to edit its action.
                            </p>
                        )}
                    </div>
                </aside>
            ) : (
                open && (
                    <div className="p-2 col-start-2 row-start-2 w-full">
                        <Card className="relative">
                            <CardContent className="p-4">
                                {editorBody}
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="absolute right-2 top-2 h-8 w-8 p-0"
                                    onClick={closeEditor}
                                >
                                    <X className="h-4 w-4" />
                                </Button>
                            </CardContent>
                        </Card>
                    </div>
                )
            )}
            {service && tapDanceCount > 0 && tapDanceIdx !== null && (
                <Modal
                    opened={tapDanceEditOpen}
                    onClose={() => setTapDanceEditOpen(false)}
                    title={`Tap dance #${tapDanceIdx}`}
                    xButton={true}
                    isDismissable={true}
                    showFooter={false}
                >
                    <TapDanceTab
                        key={`td-${tapDanceIdx}`}
                        service={service}
                        count={tapDanceCount}
                        opened={tapDanceEditOpen}
                        defaultIndex={tapDanceIdx}
                    />
                </Modal>
            )}
        </>
    )
}
