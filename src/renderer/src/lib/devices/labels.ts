// pattern-check: skip — pure data: display names for device forms, control kinds, curves and trigger modes.
import type {
    ControlKind,
    DeviceControl,
    DeviceForm,
    ResponseCurve,
    TriggerMode,
} from '@firmware/devices/types'

export const FORM_LABEL: Readonly<Record<DeviceForm, string>> = {
    keyboard: 'Keyboard',
    macropad: 'Macro pad',
    mouse: 'Mouse',
    gamepad: 'Gamepad',
    flightstick: 'Flight stick',
}

export const KIND_LABEL: Readonly<Record<ControlKind, string>> = {
    button: 'Button',
    wheel: 'Scroll wheel',
    stick: 'Analog stick',
    trigger: 'Analog trigger',
    hat: 'Directional pad',
    sensor: 'Optical sensor',
    encoder: 'Rotary encoder',
    axis: 'Analog axis',
}

export const CURVE_LABEL: Readonly<Record<ResponseCurve, string>> = {
    linear: 'Linear',
    aggressive: 'Aggressive',
    relaxed: 'Relaxed',
    precise: 'Precise',
}

export const TRIGGER_MODE_LABEL: Readonly<Record<TriggerMode, string>> = {
    analog: 'Analog',
    hair: 'Hair trigger',
    digital: 'Digital',
}

const count = (n: number, one: string): string =>
    `${n} ${one}${n === 1 ? '' : 's'}`

/** One-line description: "Mouse · 7 controls", "Macro pad · 9 keys · 2
 *  encoders" (keyboards count keys and encoders, not controls). */
export function deviceSummary(
    form: DeviceForm,
    controls: readonly Pick<DeviceControl, 'kind' | 'shape'>[],
): string {
    if (form !== 'keyboard' && form !== 'macropad') {
        return `${FORM_LABEL[form]} · ${count(controls.length, 'control')}`
    }
    const keys = controls.filter((c) => c.shape === 'key').length
    const encoders = controls.filter((c) => c.kind === 'encoder').length
    const enc = encoders ? ` · ${count(encoders, 'encoder')}` : ''
    return `${FORM_LABEL[form]} · ${count(keys, 'key')}${enc}`
}
