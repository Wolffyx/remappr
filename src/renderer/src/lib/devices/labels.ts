// pattern-check: skip — pure data: display names for device forms, control kinds, curves and trigger modes.
import type {
    ControlKind,
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

/** "Mouse · 7 controls" — the one-line description of a device. */
export function deviceSummary(form: DeviceForm, controlCount: number): string {
    return `${FORM_LABEL[form]} · ${controlCount} control${controlCount === 1 ? '' : 's'}`
}
