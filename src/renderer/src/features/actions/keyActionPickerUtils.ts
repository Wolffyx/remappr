// pattern-check: skip — pure slot-validation/default helpers extracted from KeyActionPicker, no abstraction
import type { ActionSlot } from '@firmware/types'
import type { SlotKind } from './SlotBar'

export function slotBarKind(slot: ActionSlot | undefined): SlotKind {
    if (!slot) return 'plain'
    if (slot.kind === 'hid') return 'hid'
    if (slot.kind === 'layer') return 'layer'
    return 'plain'
}

export function defaultForSlot(slot: ActionSlot): number {
    // Modifier / enum slots with an explicit value list — 0 is rarely a
    // member (e.g. mod-tap MODIFIER_VALUES start at 0x01 = LCTL), so
    // pre-select the first listed value to spare the user one click.
    if (
        (slot.kind === 'modifier' || slot.kind === 'enum') &&
        slot.values &&
        slot.values.length > 0
    ) {
        return slot.values[0].value
    }
    return 0
}

export function paramsForSlots(
    source: number[],
    slots: ActionSlot[],
): number[] {
    const next: number[] = []
    for (let i = 0; i < slots.length; i++) {
        next.push(source[i] ?? defaultForSlot(slots[i]))
    }
    return next
}

// pattern-check: skip — pure slot-filtering helper alongside existing utils
// Slots to render for the current params. A trailing slot with `enabledFor`
// is shown only when the command (params[0]) is one that takes it — e.g.
// &bt's profile index appears only for BT_SEL / BT_DISC. Conditional slots are
// always trailing, so the returned prefix keeps params indices aligned.
export function visibleSlots(
    slots: ActionSlot[],
    params: number[],
): ActionSlot[] {
    const out: ActionSlot[] = []
    for (const slot of slots) {
        if (slot.enabledFor && !slot.enabledFor.includes(params[0] ?? -1)) {
            break
        }
        out.push(slot)
    }
    return out
}

export function isSlotValid(
    slot: ActionSlot,
    value: number | undefined,
    layerIds: number[],
): boolean {
    if (value === undefined) return false
    if (slot.kind === 'hid') {
        // ZMK encodes (page<<16)|usage; QMK emits raw 16-bit (page implicit).
        // Accept any non-zero numeric value; per-firmware codec already
        // verified encodability when picker built `valueByEntryId`.
        return value !== 0
    }
    if (slot.kind === 'layer') return layerIds.includes(value)
    if (slot.kind === 'number' && slot.range) {
        return value >= slot.range.min && value <= slot.range.max
    }
    if (
        (slot.kind === 'enum' || slot.kind === 'modifier') &&
        slot.values &&
        slot.values.length > 0
    ) {
        return slot.values.some((v) => v.value === value)
    }
    if (slot.kind === 'action') return true
    return false
}
