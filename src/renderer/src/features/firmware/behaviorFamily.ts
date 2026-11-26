// Pattern check: no GoF pattern (-) — rejected — one predicate over the capability
// flags plus a store-reading hook; nothing varies per firmware.
//
// Behavior families a keyboard may be built without (tap-hold, combos, macros,
// sequences, Unicode, conditional layers, key overrides). The adapter reports
// each in Capabilities.behaviors: `false` = built out, so its editors, tools and
// picker tiles hide; `true` or absent = present (older firmware, other
// firmwares). Never gate on a firmware name.
import type { FirmwareBehaviorFlags, KeyboardService } from '@firmware/service'
import useConnectionStore from '@/stores/connectionStore'

export type BehaviorFamily = Extract<
    keyof FirmwareBehaviorFlags,
    | 'tapHold'
    | 'combos'
    | 'macros'
    | 'sequences'
    | 'unicode'
    | 'conditionals'
    | 'keyOverrides'
>

/** Whether `service` has `family` built in (true when it does not say). */
export function serviceHasFamily(
    service: Pick<KeyboardService, 'capabilities'> | null | undefined,
    family: BehaviorFamily,
): boolean {
    return service?.capabilities.behaviors?.[family] !== false
}

/** Whether the connected device has `family` built in. */
export function useBehaviorFamily(family: BehaviorFamily): boolean {
    return useConnectionStore((s) => serviceHasFamily(s.service, family))
}
