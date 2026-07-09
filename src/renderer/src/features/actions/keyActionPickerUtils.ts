// pattern-check: skip — pure slot-validation/default helpers extracted from KeyActionPicker, no abstraction
import type { ActionSlot, ActionType, BehaviorRef } from '@firmware/types'
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

/** Every behavior id referenced by a composite ActionType's slot-value
 *  behaviorRef — i.e. the raw behaviors folded into a composite. The picker hides
 *  these from the action dropdown so each behavior keeps one pick path. */
export function subsumedBehaviorIds(actionTypes: ActionType[]): Set<string> {
    const out = new Set<string>()
    for (const t of actionTypes) {
        for (const id of t.subsumes ?? []) out.add(id)
        for (const slot of t.slots) {
            for (const v of slot.values ?? []) {
                if (v.behaviorRef) out.add(v.behaviorRef.kind)
            }
        }
    }
    return out
}

/** Param equality, padding the shorter array with 0 — a stored [mask, 0] matches a
 *  behaviorRef's [mask]. */
export function sameParams(a: number[], b: number[]): boolean {
    const n = Math.max(a.length, b.length)
    for (let i = 0; i < n; i++) {
        if ((a[i] ?? 0) !== (b[i] ?? 0)) return false
    }
    return true
}

/** The behaviorRef of the value currently picked in a composite ActionType's enum
 *  slot, or undefined for a normal (non-composite) type. Picking such a value emits
 *  its behavior directly rather than { type id, [value] }. */
export function behaviorRefFor(
    actionType: ActionType | undefined,
    params: number[],
): BehaviorRef | undefined {
    if (!actionType) return undefined
    for (let i = 0; i < actionType.slots.length; i++) {
        const slot = actionType.slots[i]
        if (slot.kind !== 'enum' || !slot.values?.some((v) => v.behaviorRef)) {
            continue
        }
        const chosen = slot.values.find((v) => v.value === params[i])
        if (chosen?.behaviorRef) return chosen.behaviorRef
    }
    return undefined
}

/** Reverse-map a committed action to the (possibly composite) picker selection. A
 *  key bound to a subsumed behavior (e.g. &mmv) re-selects the composite type
 *  (unified Mouse) + the matching command; an exact param match picks that command,
 *  else the composite's first command (so a custom-magnitude delta still resolves).
 *  Normal behaviors pass through unchanged. */
export function resolveSelection(
    actionTypes: ActionType[],
    action: { kind: string; params: number[] },
): { kind: string; params: number[] } {
    for (const t of actionTypes) {
        for (let i = 0; i < t.slots.length; i++) {
            const slot = t.slots[i]
            if (slot.kind !== 'enum') continue
            const hit = slot.values?.find((v) => {
                const ref = v.behaviorRef
                return (
                    ref !== undefined &&
                    ref.kind === action.kind &&
                    sameParams(ref.params ?? [], action.params)
                )
            })
            if (hit) {
                const params = Array<number>(i).fill(0)
                params[i] = hit.value
                return { kind: t.id, params }
            }
        }
    }
    // Fallback: a behavior this composite represents — folded (params match no
    // command) or suppressed with no command (e.g. an unsettable &mmv key loaded
    // from a keymap file) — still selects the composite's first command rather than
    // surfacing the hidden raw type.
    for (const t of actionTypes) {
        const represents =
            (t.subsumes ?? []).includes(action.kind) ||
            t.slots.some((s) =>
                s.values?.some((v) => v.behaviorRef?.kind === action.kind),
            )
        if (!represents) continue
        const found = t.slots.findIndex(
            (s) => s.kind === 'enum' && (s.values?.length ?? 0) > 0,
        )
        const i = found >= 0 ? found : 0
        const params = Array<number>(i).fill(0)
        params[i] = t.slots[i]?.values?.[0]?.value ?? 0
        return { kind: t.id, params }
    }
    return { kind: action.kind, params: [...action.params] }
}
