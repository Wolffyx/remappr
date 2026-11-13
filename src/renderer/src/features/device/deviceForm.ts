// Pattern check: no GoF pattern (-) — rejected — pure converters between the
// device document (@firmware/config device.ts) and the editors' text drafts,
// driven by the lib's field tables; plain functions, no abstraction.
//
// Form state for the dongle and mouse settings pages. Numbers are edited as
// text so a field can be left empty: empty means "the firmware default", and
// the field is then left out of the document. Booleans are written only when
// they differ from the default or the stored document already had them, so a
// saved document carries only what the user chose.
import {
    compactSection,
    type ConfigDevice,
    type ConfigMouse,
    type ConfigRadioSettings,
    type DeviceNumberField,
    DONGLE_FIELDS,
    type DongleSettings,
    MOUSE_BUTTON_MAP_IDENTITY,
    MOUSE_SCROLL_DIVISOR_FIELD,
    RADIO_AUTO_PAIR_DEFAULT,
    RADIO_FIELDS,
} from '@firmware/config'

export type NumberDraft<K extends string> = Record<K, string>
export type DraftErrors = Record<string, string>

/** The text drafts of `fields`, seeded from `section` ('' = left out). */
export function numberDraft<K extends string>(
    fields: readonly DeviceNumberField<K>[],
    section: Partial<Record<K, number>> | undefined,
): NumberDraft<K> {
    const out = {} as NumberDraft<K>
    for (const f of fields) {
        const v = section?.[f.key]
        out[f.key] = v === undefined ? '' : String(v)
    }
    return out
}

/** Parse one draft: undefined when empty, else an integer inside the field's
 *  range, or an error message. */
export function parseNumber<K extends string>(
    f: DeviceNumberField<K>,
    text: string,
): { value?: number; error?: string } {
    const t = text.trim()
    if (t === '') return {}
    if (!/^-?\d+$/.test(t)) return { error: 'Whole number' }
    const value = Number(t)
    if (value < f.min || value > f.max) {
        return { error: `${f.min}–${f.max}` }
    }
    return { value }
}

/** The values of `draft` (empty fields left out) plus any errors by key. */
export function readNumbers<K extends string>(
    fields: readonly DeviceNumberField<K>[],
    draft: NumberDraft<K>,
): { values: Partial<Record<K, number>>; errors: DraftErrors } {
    const values: Partial<Record<K, number>> = {}
    const errors: DraftErrors = {}
    for (const f of fields) {
        const r = parseNumber(f, draft[f.key])
        if (r.error) errors[f.key] = r.error
        else if (r.value !== undefined) values[f.key] = r.value
    }
    return { values, errors }
}

/** A boolean as the document should carry it: left out while it is the default
 *  and the stored document did not set it. */
export function keepBool(
    value: boolean,
    stored: boolean | undefined,
    defaultValue: boolean,
): boolean | undefined {
    return stored === undefined && value === defaultValue ? undefined : value
}

/* ── dongle ─────────────────────────────────────────────────────────────── */

/** NKRO on save: leave the routing as it is, or set it. */
export type NkroChoice = 'keep' | 'nkro' | 'boot'

export interface DongleDraft {
    nkro: NkroChoice
    numbers: NumberDraft<(typeof DONGLE_FIELDS)[number]['key']>
}

export function dongleDraft(d: DongleSettings | undefined): DongleDraft {
    return {
        nkro: d?.nkro === undefined ? 'keep' : d.nkro ? 'nkro' : 'boot',
        numbers: numberDraft(DONGLE_FIELDS, d),
    }
}

const fieldDefault = <K extends string>(
    fields: readonly DeviceNumberField<K>[],
    key: K,
): number => fields.find((f) => f.key === key)?.defaultValue ?? 0

/** The dongle section a draft stands for, or the errors that block a save. */
export function dongleFromDraft(draft: DongleDraft): {
    dongle?: DongleSettings
    errors: DraftErrors
} {
    const { values, errors } = readNumbers(DONGLE_FIELDS, draft.numbers)
    const failsafe =
        values.failsafeMs ?? fieldDefault(DONGLE_FIELDS, 'failsafeMs')
    if (values.rosterLiveMs !== undefined && values.rosterLiveMs < failsafe) {
        errors.rosterLiveMs = `Not below the failsafe (${failsafe} ms)`
    }
    const nkro = draft.nkro === 'keep' ? undefined : draft.nkro === 'nkro'
    return { dongle: compactSection({ nkro, ...values }), errors }
}

/* ── radio (mouse) ──────────────────────────────────────────────────────── */

export interface RadioDraft {
    autoPair: boolean
    numbers: NumberDraft<(typeof RADIO_FIELDS)[number]['key']>
}

export function radioDraft(r: ConfigRadioSettings | undefined): RadioDraft {
    return {
        autoPair: r?.autoPair ?? RADIO_AUTO_PAIR_DEFAULT,
        numbers: numberDraft(RADIO_FIELDS, r),
    }
}

export function radioFromDraft(
    draft: RadioDraft,
    stored: ConfigRadioSettings | undefined,
): { radio?: ConfigRadioSettings; errors: DraftErrors } {
    const { values, errors } = readNumbers(RADIO_FIELDS, draft.numbers)
    const autoPair = keepBool(
        draft.autoPair,
        stored?.autoPair,
        RADIO_AUTO_PAIR_DEFAULT,
    )
    return { radio: compactSection({ autoPair, ...values }), errors }
}

/* ── mouse pointer ──────────────────────────────────────────────────────── */

export const MOUSE_FLAGS = [
    'invertX',
    'invertY',
    'invertWheel',
    'invertHwheel',
    'swapXY',
] as const
export type MouseFlag = (typeof MOUSE_FLAGS)[number]

/** One acceleration-curve point as edited: input speed and multiplier in %. */
export interface CurvePointDraft {
    speed: string
    percent: string
}

/** A button-map entry as edited: an output button, or 'off'. */
export type ButtonChoice = number | 'off'

export interface MouseDraft {
    /** '' = the sensor's own resolution. */
    cpi: string
    flags: Record<MouseFlag, boolean>
    scrollDivisor: string
    curve: CurvePointDraft[]
    buttons: ButtonChoice[]
}

/** The DPI the mouse starts on: its starting DPI stage when it has stages
 *  (they own the DPI), else `cpi`. */
function startDpi(m: ConfigMouse | undefined): number | undefined {
    return m?.dpiStages ? m.dpiStages[m.dpiStage ?? 0] : m?.cpi
}

export function mouseDraft(m: ConfigMouse | undefined): MouseDraft {
    const flags = {} as Record<MouseFlag, boolean>
    for (const k of MOUSE_FLAGS) flags[k] = m?.[k] ?? false
    const map = m?.buttonMap ?? MOUSE_BUTTON_MAP_IDENTITY
    const dpi = startDpi(m)
    return {
        cpi: dpi === undefined || dpi === 0 ? '' : String(dpi),
        flags,
        scrollDivisor:
            m?.scrollDivisor === undefined ? '' : String(m.scrollDivisor),
        curve: (m?.accel ?? []).map(([speed, mult]) => ({
            speed: String(speed),
            percent: String(mult),
        })),
        buttons: map.map((b) => (b === null ? 'off' : b)),
    }
}

/** The sensor's DPI range (GET_MOTION_CONFIG); null before it is read. */
export interface DpiRange {
    min: number
    max: number
}

function readCpi(
    text: string,
    range: DpiRange | null,
): { value?: number; error?: string } {
    const t = text.trim()
    if (t === '') return {}
    if (!/^\d+$/.test(t)) return { error: 'Whole number' }
    const value = Number(t)
    if (range && (value < range.min || value > range.max)) {
        return { error: `${range.min}–${range.max}` }
    }
    return { value }
}

const U16_MAX = 0xffff

function readCurve(curve: CurvePointDraft[]): {
    accel?: [number, number][]
    error?: string
} {
    if (curve.length === 0) return {}
    const points: [number, number][] = []
    for (const p of curve) {
        const speed = Number(p.speed.trim())
        const percent = Number(p.percent.trim())
        const bad = (v: number, s: string): boolean =>
            s.trim() === '' || !Number.isInteger(v) || v < 0 || v > U16_MAX
        if (bad(speed, p.speed) || bad(percent, p.percent)) {
            return {
                error: `Each point needs a speed and a percentage, 0–${U16_MAX}`,
            }
        }
        points.push([speed, percent])
    }
    points.sort((a, b) => a[0] - b[0])
    if (new Set(points.map((p) => p[0])).size !== points.length) {
        return { error: 'Two points share a speed' }
    }
    return { accel: points }
}

/** The mouse section a draft stands for, or the errors that block a save.
 *  Settings the page does not edit (autoLayerTimeoutMs) are kept from
 *  `stored`. */
export function mouseFromDraft(
    draft: MouseDraft,
    stored: ConfigMouse | undefined,
    range: DpiRange | null,
): { mouse?: ConfigMouse; errors: DraftErrors } {
    const errors: DraftErrors = {}
    const cpi = readCpi(draft.cpi, range)
    if (cpi.error) errors.cpi = cpi.error
    const div = parseNumber(MOUSE_SCROLL_DIVISOR_FIELD, draft.scrollDivisor)
    if (div.error) errors.scrollDivisor = div.error
    const curve = readCurve(draft.curve)
    if (curve.error) errors.curve = curve.error

    const flags: Partial<Record<MouseFlag, boolean>> = {}
    for (const k of MOUSE_FLAGS) {
        flags[k] = keepBool(draft.flags[k], stored?.[k], false)
    }
    const map = draft.buttons.map((b) => (b === 'off' ? null : b))
    const identity = map.every((b, i) => b === MOUSE_BUTTON_MAP_IDENTITY[i])
    const buttonMap = identity && !stored?.buttonMap ? undefined : map

    const mouse = compactSection<ConfigMouse>({
        ...stored,
        ...dpiFields(stored, cpi.value),
        accel: curve.accel,
        scrollDivisor: div.value,
        buttonMap,
        ...flags,
    })
    return { mouse, errors }
}

/** The edited DPI as document fields: with DPI stages it is the starting
 *  stage's DPI (clearing it keeps the stage), else `cpi`. */
function dpiFields(
    stored: ConfigMouse | undefined,
    value: number | undefined,
): Pick<ConfigMouse, 'cpi' | 'dpiStages'> {
    if (!stored?.dpiStages) return { cpi: value }
    if (value === undefined) return {}
    const stages = [...stored.dpiStages]
    stages[stored.dpiStage ?? 0] = value
    return { dpiStages: stages }
}

/* ── document ───────────────────────────────────────────────────────────── */

const sortedJson = (o: object | undefined): string =>
    JSON.stringify(
        Object.entries(o ?? {})
            .filter(([, v]) => v !== undefined)
            .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
    )

/** Two sections hold the same settings, whatever their key order. */
export function sameSection(
    a: object | undefined,
    b: object | undefined,
): boolean {
    return sortedJson(a) === sortedJson(b)
}

/** `base` with its dongle / mouse / radio sections replaced (an undefined
 *  one is removed). The sections these pages do not edit (the sensor's,
 *  the joystick's, the power timeouts) are kept as they are. */
export function withSections(
    base: ConfigDevice,
    sections: Pick<ConfigDevice, 'dongle' | 'mouse' | 'radio'>,
): ConfigDevice {
    const out: ConfigDevice = {
        schemaVersion: base.schemaVersion,
        kind: base.kind,
        meta: base.meta,
        personality: base.personality,
    }
    if (base.sensor) out.sensor = base.sensor
    if (base.joystick) out.joystick = base.joystick
    if (base.power) out.power = base.power
    if (sections.dongle) out.dongle = sections.dongle
    if (sections.mouse) out.mouse = sections.mouse
    if (sections.radio) out.radio = sections.radio
    return out
}

/** `base` with its power timeouts replaced; an empty or undefined section is
 *  removed (the device's build defaults). */
export function withPower(
    base: ConfigDevice,
    power: ConfigDevice['power'],
): ConfigDevice {
    const out: ConfigDevice = { ...base }
    delete out.power
    return power && Object.keys(power).length ? { ...out, power } : out
}
