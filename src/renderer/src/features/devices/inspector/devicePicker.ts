// Pattern check: Adapter (Tier 1) — applied — translates a device's ControlsCatalog into the keyboard picker's vocabulary (ActionType[] + KeyAction + a usage-limited codec and catalog) and back, so KeyActionPicker serves every device unchanged.
//
// One action picker for every device. The keyboard editor's KeyActionPicker
// speaks behaviors (ActionType) with slots; a mouse or a joystick binds
// actions from its adapter's own catalog. This bridge presents that catalog as
// behaviors, all from what the adapter declares:
//   - every action carrying a HID usage the key catalog knows → one "Key
//     press" behavior with the keycode grid, limited to those keys;
//   - every other action → its group as a behavior, the actions as its list;
//   - "Disabled" → no action.
import { filterCatalogByCodec } from '@firmware/catalog/filter'
import type { KeyCatalog } from '@firmware/catalog/types'
import { hidUsageCodec } from '@firmware/catalog/hidUsageCodec'
import type { KeycodeCodec } from '@firmware/codec'
import type {
    ActionId,
    ControlsCatalog,
    DeviceAction,
} from '@firmware/devices/types'
import type { ActionType, KeyAction } from '@firmware/types'

export const KEYS_TYPE = 'device:keys'
export const NONE_TYPE = 'device:none'
const groupType = (group: string): string => `device:group:${group}`

/** A choice as the picker reports it. */
export interface PickerDraft {
    kind: string
    params: number[]
}

export interface DevicePicker {
    readonly actionTypes: ActionType[]
    /** The HID-usage codec limited to this device's keys. */
    readonly codec: KeycodeCodec
    /** The key catalog limited to this device's keys. */
    readonly catalog: KeyCatalog
    /** A binding's action as the picker's current choice. */
    toKeyAction(id: ActionId | null | undefined): KeyAction
    /** The action a picker choice means: null for Disabled, undefined when
     *  the choice is not one of this device's actions. */
    fromDraft(draft: PickerDraft): ActionId | null | undefined
}

/** The packed HID usage of `a` when the key catalog knows it. */
function knownUsage(a: DeviceAction): number | undefined {
    if (a.usage === undefined) return undefined
    return hidUsageCodec.decode(a.usage) ? a.usage >>> 0 : undefined
}

/** The HID-usage codec, answering only for `usages`. */
function usageCodec(usages: ReadonlySet<number>): KeycodeCodec {
    const offered = (value: number | undefined): boolean =>
        value !== undefined && usages.has(value >>> 0)
    return {
        encode: (id) => {
            const e = hidUsageCodec.encode(id)
            return e && offered(e.value) ? e : null
        },
        decode: (raw) => (offered(raw) ? hidUsageCodec.decode(raw) : null),
        supports: (id) => offered(hidUsageCodec.encode(id)?.value),
    }
}

const listType = (
    id: string,
    label: string,
    actions: readonly DeviceAction[],
): ActionType => ({
    id,
    displayName: label,
    slots: [
        {
            label,
            kind: 'enum',
            values: actions.map((a, value) => ({ value, label: a.label })),
        },
    ],
})

const KEYS: ActionType = {
    id: KEYS_TYPE,
    displayName: 'Key press',
    slots: [{ label: 'Key', kind: 'hid' }],
}

const NONE: ActionType = { id: NONE_TYPE, displayName: 'Disabled', slots: [] }

/** The picker's view of `catalog`. */
export function devicePicker(catalog: ControlsCatalog): DevicePicker {
    const byUsage = new Map<number, DeviceAction>()
    const lists = new Map<string, DeviceAction[]>()
    for (const a of catalog.actions) {
        const usage = knownUsage(a)
        if (usage !== undefined && !byUsage.has(usage)) {
            byUsage.set(usage, a)
            continue
        }
        const list = lists.get(a.group) ?? []
        list.push(a)
        lists.set(a.group, list)
    }

    // Groups in the catalog's order; Key press where the first keyed group is.
    const actionTypes: ActionType[] = []
    const keyedGroups = new Set([...byUsage.values()].map((a) => a.group))
    for (const g of catalog.groups) {
        if (keyedGroups.has(g.id) && !actionTypes.includes(KEYS)) {
            actionTypes.push(KEYS)
        }
        const list = lists.get(g.id)
        if (list?.length)
            actionTypes.push(listType(groupType(g.id), g.label, list))
    }
    if (byUsage.size && !actionTypes.includes(KEYS)) actionTypes.unshift(KEYS)
    actionTypes.push(NONE)

    const usages = new Set(byUsage.keys())
    const codec = usageCodec(usages)
    const where = new Map<ActionId, PickerDraft>()
    for (const [usage, a] of byUsage) {
        where.set(a.id, { kind: KEYS_TYPE, params: [usage] })
    }
    for (const [group, list] of lists) {
        list.forEach((a, i) =>
            where.set(a.id, { kind: groupType(group), params: [i] }),
        )
    }
    const labelOf = new Map(catalog.actions.map((a) => [a.id, a.label]))

    return {
        actionTypes,
        codec,
        catalog: filterCatalogByCodec(codec),
        toKeyAction: (id) => {
            if (id == null) {
                return { kind: NONE_TYPE, params: [], label: { primary: '' } }
            }
            const at = where.get(id)
            const primary = labelOf.get(id) ?? id
            // An id this catalog does not list: no choice is highlighted.
            if (!at) return { kind: '', params: [], label: { primary } }
            return { ...at, params: [...at.params], label: { primary } }
        },
        fromDraft: ({ kind, params }) => {
            if (kind === NONE_TYPE) return null
            if (kind === KEYS_TYPE) return byUsage.get(params[0]! >>> 0)?.id
            const list = [...lists].find(([g]) => groupType(g) === kind)?.[1]
            return list?.[params[0] ?? -1]?.id
        },
    }
}
