// pattern-check: skip — pure slot→dropdown-config lookup extracted from
// SlotValuePicker so the component file only exports components (react-refresh).
import type { ReactNode } from 'react'
import type { ActionSlot } from '@firmware/types'

export interface SelectOption {
    value: number
    label: ReactNode
}

export interface SelectConfig {
    options: SelectOption[]
    placeholder: string
    /** Trigger id / htmlFor target; its presence also draws a leading Label. */
    id?: string
    label?: string
}

// The dropdown a slot renders as, or null when the slot is not a value list
// (HID grid, wide numeric range, nested action). Centralising the per-kind
// option lists here keeps the picker a single, shared Select.
export function selectConfigForSlot(
    slot: ActionSlot,
    layers: { id: number; name: string }[],
): SelectConfig | null {
    if (slot.kind === 'layer') {
        return {
            id: 'slotValuePickerLayer',
            label: slot.label,
            placeholder: 'Layer',
            options: layers.map((l) => ({ value: l.id, label: l.name })),
        }
    }
    if (
        (slot.kind === 'enum' || slot.kind === 'modifier') &&
        slot.values &&
        slot.values.length > 0
    ) {
        return {
            placeholder: slot.label,
            options: slot.values.map((v) => ({
                value: v.value,
                label: v.label,
            })),
        }
    }
    if (slot.kind === 'number' && slot.range) {
        const { min, max } = slot.range
        const span = max - min
        // Small enumerable ranges (e.g. a BT profile index) render as a dropdown
        // of every valid value — clearer than a free box and it can't hold an
        // out-of-range entry. Wide ranges fall through to the numeric input.
        if (span < 0 || span > 32) return null
        return {
            id: 'slotValuePickerRange',
            label: slot.label,
            placeholder: slot.label,
            options: Array.from({ length: span + 1 }, (_, i) => {
                const raw = min + i
                // Store the raw index; label it one-based when the slot asks —
                // a BT profile reads as 1..N though it is sent 0-based.
                return { value: raw, label: slot.oneBased ? raw + 1 : raw }
            }),
        }
    }
    return null
}
