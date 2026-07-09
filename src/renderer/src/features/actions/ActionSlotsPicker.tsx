// Pattern check: no GoF pattern (-) — rejected — slot dispatcher routes on activeSlotIndex; no abstraction warranted.
import type { ActionSlot } from '@firmware/types'
import type { KeycodeCodec } from '@firmware/codec'
import type { KeyCatalog } from '@firmware/catalog/types'
import { SlotValuePicker } from './SlotValuePicker'

// pattern-check: skip optional onActionChosen/codec/typeIcon pass-through props — mechanical prop forwarding to SlotValuePicker
export interface ActionSlotsPickerProps {
    slots: ActionSlot[]
    values: number[]
    layers: { id: number; name: string }[]
    activeSlotIndex: number
    onSlotChanged: (slotIndex: number, value?: number) => void
    onActionChosen?: (kind: string, params?: number[]) => void
    highlightedKeys?: number[]
    holdInvalidHint?: string
    codec?: KeycodeCodec
    catalog?: KeyCatalog
    typeIcon?: string
}

export const ActionSlotsPicker = ({
    slots,
    values,
    layers,
    activeSlotIndex,
    onSlotChanged,
    onActionChosen,
    highlightedKeys,
    holdInvalidHint,
    codec,
    catalog,
    typeIcon,
}: ActionSlotsPickerProps): JSX.Element | null => {
    if (slots.length === 0) return null

    const isHoldTap = slots.length > 1
    const safeIndex = Math.min(Math.max(activeSlotIndex, 0), slots.length - 1)
    const activeSlot = slots[safeIndex]
    const activeValue = values[safeIndex]

    if (!isHoldTap) {
        return (
            <div className="flex flex-row flex-wrap items-center gap-2 mt-3">
                <SlotValuePicker
                    slot={activeSlot}
                    value={activeValue}
                    layers={layers}
                    highlightedKeys={highlightedKeys}
                    onChange={(v) => onSlotChanged(safeIndex, v)}
                    onActionChosen={onActionChosen}
                    codec={codec}
                    catalog={catalog}
                    typeIcon={typeIcon}
                />
            </div>
        )
    }

    return (
        <div className="flex flex-col gap-2 mt-3">
            {holdInvalidHint && safeIndex === 1 && (
                <p className="text-xs text-amber-500 italic">
                    {holdInvalidHint}
                </p>
            )}
            <div className="flex flex-row flex-wrap items-center gap-2">
                <SlotValuePicker
                    key={safeIndex}
                    slot={activeSlot}
                    value={activeValue}
                    layers={layers}
                    highlightedKeys={highlightedKeys}
                    onChange={(v) => onSlotChanged(safeIndex, v)}
                    onActionChosen={onActionChosen}
                    codec={codec}
                    catalog={catalog}
                    typeIcon={typeIcon}
                />
            </div>
        </div>
    )
}
