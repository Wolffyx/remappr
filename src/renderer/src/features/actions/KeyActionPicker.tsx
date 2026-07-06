// Pattern check: no GoF pattern (-) — rejected — picker state container over neutral KeyAction/ActionType, dispatches on slot.kind, no abstraction needed.
import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import type { ActionSlot, ActionType, KeyAction } from '@firmware/types'
import type { KeycodeCodec } from '@firmware/codec'
import type { KeyCatalog } from '@firmware/catalog/types'
import { ActionTypeSelector } from './ActionTypeSelector'
import { ActionSlotsPicker } from './ActionSlotsPicker'
import { SlotBar, type SlotDescriptor } from './SlotBar'
import {
    defaultForSlot,
    isSlotValid,
    paramsForSlots,
    slotBarKind,
    visibleSlots,
} from './keyActionPickerUtils'
import { isMacroOrCombo } from '@/lib/keymap/behaviorClassify'

export interface KeyActionDraft {
    kind: string
    params: number[]
}

// pattern-check: skip additive optional codec-injection prop on existing props interface
export interface KeyActionPickerProps {
    action: KeyAction
    actionTypes: ActionType[]
    layers: { id: number; name: string }[]
    onChange: (draft: KeyActionDraft) => void
    /** Optional codec override forwarded to the keycode grid; the deviceless
     *  builder injects the HID-usage mockCodec so the grid works with no
     *  connection. The editor omits it (grid reads the device codec). */
    codec?: KeycodeCodec
    /** Optional firmware-filtered catalog forwarded to the keycode grid. */
    catalog?: KeyCatalog
}

// pattern-check: skip mechanical move of pure slot helpers to sibling utils
export const KeyActionPicker = ({
    action,
    actionTypes,
    layers,
    onChange,
    codec,
    catalog,
}: KeyActionPickerProps): JSX.Element => {
    const [kind, setKind] = useState<string>(action.kind)
    const [params, setParams] = useState<number[]>([...action.params])
    const [activeSlotIndex, setActiveSlotIndex] = useState<number>(0)

    const actionType = useMemo(
        (): ActionType | undefined => actionTypes.find((t) => t.id === kind),
        [actionTypes, kind],
    )
    const slots = useMemo<ActionSlot[]>(
        () => actionType?.slots ?? [],
        [actionType],
    )
    // Trailing slots gated by the chosen command (e.g. &bt's profile index,
    // valid only for BT_SEL / BT_DISC) stay hidden until such a command is
    // picked. `visible` drives every layout/validation decision below.
    const visible = useMemo<ActionSlot[]>(
        () => visibleSlots(slots, params),
        [slots, params],
    )
    const isHoldTap = visible.length > 1
    const safeActive = Math.min(
        Math.max(activeSlotIndex, 0),
        Math.max(visible.length - 1, 0),
    )

    useEffect((): void => {
        /* eslint-disable react-hooks/set-state-in-effect */
        setKind(action.kind)
        setParams([...action.params])
        /* eslint-enable react-hooks/set-state-in-effect */
    }, [action])

    const layerIds = useMemo(() => layers.map((l) => l.id), [layers])

    // Macros / combos surface as catalog tiles (Macros / Combos tabs);
    // hide them from the action-type dropdown so each behavior has
    // exactly one pick path. Resolution by id stays intact since the
    // unfiltered actionTypes list still feeds the lookup.
    const dropdownHidden = useMemo(
        (): Set<string> =>
            new Set(actionTypes.filter(isMacroOrCombo).map((t) => t.id)),
        [actionTypes],
    )

    const dispatch = useCallback(
        (nextKind: string, nextParams: number[]): void => {
            const target = actionTypes.find((t) => t.id === nextKind)
            const targetSlots = target?.slots ?? []
            // Only the visible slots belong to the binding — a gated-out
            // trailing param (e.g. &bt's profile for BT_CLR) is dropped so the
            // stored action is `[command]`, not `[command, staleProfile]`.
            const vis = visibleSlots(targetSlots, nextParams)
            const trimmed = nextParams.slice(0, vis.length)
            if (
                nextKind === action.kind &&
                trimmed.length === action.params.length &&
                trimmed.every((v, i) => v === action.params[i])
            ) {
                return
            }
            const allValid = vis.every((slot, i) =>
                isSlotValid(slot, trimmed[i], layerIds),
            )
            if (!allValid) return
            onChange({ kind: nextKind, params: trimmed })
        },
        [action, actionTypes, layerIds, onChange],
    )

    const handleTypeSelected = (selectedId: string): void => {
        const target = actionTypes.find((t) => t.id === selectedId)
        const nextParams = paramsForSlots([], target?.slots ?? [])
        setKind(selectedId)
        setParams(nextParams)
        setActiveSlotIndex(0)
        dispatch(selectedId, nextParams)
    }

    // pattern-check: skip — gating an existing slot handler, no new abstraction
    const handleSlotChanged = (slotIndex: number, value?: number): void => {
        const nextParams = [...params]
        nextParams[slotIndex] = value ?? 0
        // Changing the command can reveal a trailing slot (e.g. picking BT_SEL
        // shows the profile index) — seed its default so the binding completes.
        const vis = visibleSlots(slots, nextParams)
        for (let i = 0; i < vis.length; i++) {
            if (nextParams[i] === undefined) {
                nextParams[i] = defaultForSlot(vis[i])
            }
        }
        setParams(nextParams)
        if (activeSlotIndex > vis.length - 1) {
            setActiveSlotIndex(Math.max(vis.length - 1, 0))
        }
        dispatch(kind, nextParams)
        if (vis.length <= 1 || value === undefined || value === 0) return

        const isLast = slotIndex === vis.length - 1
        if (!isLast) {
            if (vis[slotIndex].kind !== 'modifier') {
                setActiveSlotIndex(slotIndex + 1)
            }
            return
        }

        const allValid = vis.every((s, i) =>
            isSlotValid(s, nextParams[i], layerIds),
        )
        if (allValid) {
            setActiveSlotIndex((slotIndex + 1) % vis.length)
            return
        }
        const missingIdx = vis.findIndex(
            (s, i) => !isSlotValid(s, nextParams[i], layerIds),
        )
        if (missingIdx >= 0 && missingIdx !== slotIndex) {
            toast.info(
                `Select ${vis[missingIdx].label.toLowerCase()} to complete the binding`,
            )
        }
    }

    const layerNameFor = (value?: number): string | undefined => {
        if (value === undefined) return undefined
        return layers.find((l) => l.id === value)?.name
    }

    const slotBarSlots = useMemo<SlotDescriptor[]>(() => {
        if (!isHoldTap) return []
        return visible.map((slot, i) => ({
            id: String(i),
            label: slot.label,
            value: params[i],
            kind: slotBarKind(slot),
            valueLabel:
                slot.kind === 'enum' || slot.kind === 'modifier'
                    ? slot.values?.find((v) => v.value === params[i])?.label
                    : undefined,
            layerName: layerNameFor(params[i]),
            inactiveBorderClass: i === 0 ? 'border-secondary' : 'border-accent',
            onRemove: (): void => {
                const next = [...params]
                next[i] = 0
                if (i === 0) {
                    for (let k = 0; k < next.length; k++) next[k] = 0
                }
                setParams(next)
                setActiveSlotIndex(0)
                dispatch(kind, next)
            },
        }))
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isHoldTap, visible, params, layers, kind, dispatch])

    const highlightedKeys = useMemo<number[] | undefined>(() => {
        if (!isHoldTap) return undefined
        if (visible[0]?.kind !== 'hid') return undefined
        const out: number[] = []
        if (params[0] && params[0] !== 0) out.push(params[0])
        if (params[1] && params[1] !== 0 && visible[1]?.kind === 'hid') {
            out.push(params[1])
        }
        return out
    }, [isHoldTap, visible, params])

    return (
        <div className="flex flex-col w-full gap-3">
            <div className="flex flex-row flex-wrap gap-3 items-center">
                <ActionTypeSelector
                    actionTypes={actionTypes}
                    hideIds={dropdownHidden}
                    selectedId={kind}
                    onSelect={handleTypeSelected}
                    placeholder="Select action..."
                />
                {isHoldTap && (
                    <SlotBar
                        slots={slotBarSlots}
                        activeSlotId={String(safeActive)}
                        onActivate={(id) => setActiveSlotIndex(parseInt(id))}
                    />
                )}
            </div>
            {visible.length > 0 && (
                <div className="flex-1">
                    <ActionSlotsPicker
                        slots={visible}
                        values={params}
                        layers={layers}
                        activeSlotIndex={safeActive}
                        onSlotChanged={handleSlotChanged}
                        onActionChosen={handleTypeSelected}
                        highlightedKeys={highlightedKeys}
                        codec={codec}
                        catalog={catalog}
                    />
                </div>
            )}
        </div>
    )
}
