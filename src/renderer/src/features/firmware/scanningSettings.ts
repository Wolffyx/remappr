// Pattern check: no GoF pattern (-) — rejected — pure selection and diff over
// the parts the device describes; plain functions.
import type {
    SensorInfo,
    SensorSettingInfo,
    SensorSettingValue,
} from '@firmware/devices/types'

/** The values the user holds per part index, by setting name. A setting left
 *  out is at its default. */
export type PartValues = Readonly<
    Record<number, Readonly<Record<string, SensorSettingValue>>>
>

/** One change to send: `part`'s setting `name` to `value`. */
export interface SettingChange {
    readonly part: number
    readonly name: string
    readonly value: SensorSettingValue
}

/** Settings a user can set as part settings (not a personality's own). */
const settable = (p: SensorInfo): readonly SensorSettingInfo[] =>
    p.settings.filter((s) => !s.personality)

/** The device's key-matrix parts, each with only its settable settings; a
 *  matrix that describes none is left out. */
export function matrixParts(parts: readonly SensorInfo[]): SensorInfo[] {
    return parts
        .filter((p) => p.cls === 'matrix')
        .map((p) => ({ ...p, settings: settable(p) }))
        .filter((p) => p.settings.length > 0)
}

/** What each part holds now, keeping only the values off their default (the
 *  rows then show a reset for exactly those). */
export function settingsInForce(parts: readonly SensorInfo[]): PartValues {
    const out: Record<number, Record<string, SensorSettingValue>> = {}
    for (const p of parts) {
        out[p.index] = Object.fromEntries(
            p.settings
                .filter((s) => s.value !== s.default)
                .map((s) => [s.name, s.value]),
        )
    }
    return out
}

/** The settings whose wanted value differs from the value in force. A value
 *  left out is wanted at its default. */
export function changedSettings(
    parts: readonly SensorInfo[],
    values: PartValues,
): SettingChange[] {
    const out: SettingChange[] = []
    for (const p of parts) {
        for (const s of p.settings) {
            const value = values[p.index]?.[s.name] ?? s.default
            if (value !== s.value)
                out.push({ part: p.index, name: s.name, value })
        }
    }
    return out
}
