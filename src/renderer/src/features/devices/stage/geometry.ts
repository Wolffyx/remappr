// Pattern check: Dispatch Map (Tier 0) — applied — shell type → shell-fitting function and control shape → border-radius tables replace the design's if/else and switch chains.
//
// Geometry engine of the device stage: a device model (controls in key units)
// → the body parts fitted around the controls, and the canvas layout (size,
// origin offset, callout gutters) in px. Pure, so it is unit-tested.
import type {
    ControlShape,
    DeviceControl,
    DeviceModel,
    DeviceShell,
    ShellType,
} from '@firmware/devices/types'

/** Px per key unit on the internal canvas (scaled to fit afterwards). */
export const DEV_S = 44
/** Callout card width, gap to the body and margin to the canvas edge. */
export const CALL_W = 182
export const CALL_GAP = 58
export const CALL_M = 14

export interface BoxU {
    x0: number
    y0: number
    x1: number
    y1: number
}

type Rect = Pick<DeviceControl, 'x' | 'y' | 'w' | 'h'>

/** One body part, in key units; `radius` maps its px size to a border-radius. */
export interface ShellPart {
    x: number
    y: number
    w: number
    h: number
    /** Rotation in degrees about `origin`. */
    rot?: number
    origin?: string
    /** Darker tone (the flight stick's shaft). */
    tone?: 'dark'
    radius: (wPx: number, hPx: number) => string
}

export function bboxU(list: readonly Rect[]): BoxU | null {
    if (!list.length) return null
    return list.reduce<BoxU>(
        (b, c) => ({
            x0: Math.min(b.x0, c.x),
            y0: Math.min(b.y0, c.y),
            x1: Math.max(b.x1, c.x + c.w),
            y1: Math.max(b.y1, c.y + c.h),
        }),
        { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity },
    )
}

const onBody = (cs: readonly DeviceControl[]): DeviceControl[] =>
    cs.filter((c) => !c.edge)

/** A rotated control's footprint, grown so the plate still clears it. */
function rotatedFootprint(c: DeviceControl): Rect {
    if (!c.r) return c
    const ex =
        ((Math.abs(Math.sin((c.r * Math.PI) / 180)) * (c.w + c.h)) / 2) * 0.5
    return { x: c.x - ex, y: c.y - ex, w: c.w + 2 * ex, h: c.h + 2 * ex }
}

/** Plate: one rounded slab per zone (a split keyboard gets two halves). */
function plateShell(
    sh: Extract<DeviceShell, { type: 'plate' }>,
    cs: readonly DeviceControl[],
): ShellPart[] {
    const zones = new Map<string, Rect[]>()
    for (const c of onBody(cs)) {
        const z = c.zone ?? 'body'
        zones.set(z, [...(zones.get(z) ?? []), rotatedFootprint(c)])
    }
    return [...zones.values()].flatMap((list) => {
        const b = bboxU(list)
        if (!b) return []
        return [
            {
                x: b.x0 - sh.pad,
                y: b.y0 - sh.pad,
                w: b.x1 - b.x0 + 2 * sh.pad,
                h: b.y1 - b.y0 + 2 * sh.pad,
                radius: () => `${0.45 * DEV_S}px`,
            },
        ]
    })
}

/** Mouse: one egg-shaped body over the buttons, extended by the palm rest. */
function mouseShell(
    sh: Extract<DeviceShell, { type: 'mouse' }>,
    cs: readonly DeviceControl[],
): ShellPart[] {
    const b = bboxU(onBody(cs))
    if (!b) return []
    return [
        {
            x: b.x0 - sh.pad,
            y: b.y0 - sh.pad,
            w: b.x1 - b.x0 + 2 * sh.pad,
            h: b.y1 - b.y0 + sh.pad + sh.tail,
            radius: (w, h) =>
                `${w / 2}px ${w / 2}px ${w * 0.49}px ${w * 0.49}px / ${h * 0.33}px ${h * 0.33}px ${h * 0.3}px ${h * 0.3}px`,
        },
    ]
}

/** Gamepad: a rounded body over the face controls plus two angled grips that
 *  reach below the back paddles. Bumpers / triggers (zone top) stay outside. */
function gamepadShell(
    sh: Extract<DeviceShell, { type: 'gamepad' }>,
    cs: readonly DeviceControl[],
): ShellPart[] {
    const b = bboxU(onBody(cs).filter((c) => c.zone !== 'top'))
    if (!b) return []
    const body = {
        x: b.x0 - sh.pad,
        y: b.y0 - 0.6,
        w: b.x1 - b.x0 + 2 * sh.pad,
        h: b.y1 - b.y0 + 1.05,
    }
    const low = Math.max(
        body.y + body.h + 2.2,
        ...cs.filter((c) => c.edge).map((c) => c.y + c.h + 0.6),
    )
    const gy = body.y + 1.25
    const gh = (low - gy) / Math.cos((sh.gripAngle * Math.PI) / 180)
    const grip = (w: number): string =>
        `${w * 0.4}px ${w * 0.4}px ${w * 0.52}px ${w * 0.52}px`
    return [
        {
            x: body.x + 0.3,
            y: gy,
            w: sh.gripW,
            h: gh,
            rot: sh.gripAngle,
            origin: 'top center',
            radius: grip,
        },
        {
            x: body.x + body.w - 0.3 - sh.gripW,
            y: gy,
            w: sh.gripW,
            h: gh,
            rot: -sh.gripAngle,
            origin: 'top center',
            radius: grip,
        },
        { ...body, radius: (_w, h) => `${Math.min(h / 2, 2 * DEV_S)}px` },
    ]
}

/** Flight stick: a base slab, a shaft, and a grip head over the head zone. */
function flightstickShell(
    sh: Extract<DeviceShell, { type: 'flightstick' }>,
    cs: readonly DeviceControl[],
): ShellPart[] {
    const zone = (z: string): BoxU | null =>
        bboxU(cs.filter((c) => c.zone === z && !c.edge))
    const hb = zone('head')
    const bb = zone('base')
    const grip = hb && {
        x: hb.x0 - sh.pad,
        y: hb.y0 - 0.5,
        w: hb.x1 - hb.x0 + 2 * sh.pad,
        h: hb.y1 - hb.y0 + 1.1,
    }
    const cx = grip ? grip.x + grip.w / 2 : bb ? (bb.x0 + bb.x1) / 2 : 0
    const parts: ShellPart[] = []
    const base = bb && {
        x: Math.min(bb.x0 - sh.basePad, cx - 2),
        y: bb.y0 - sh.basePad,
        w:
            Math.max(bb.x1 + sh.basePad, cx + 2) -
            Math.min(bb.x0 - sh.basePad, cx - 2),
        h: bb.y1 - bb.y0 + 2 * sh.basePad,
    }
    if (base) parts.push({ ...base, radius: () => `${0.65 * DEV_S}px` })
    if (grip && base) {
        parts.push({
            x: cx - sh.shaftW / 2,
            y: grip.y + grip.h - 0.2,
            w: sh.shaftW,
            h: Math.max(0.2, base.y - grip.y - grip.h + 0.4),
            tone: 'dark',
            radius: () => '8px',
        })
    }
    if (grip) {
        parts.push({
            ...grip,
            radius: (w, h) =>
                `${w * 0.48}px ${w * 0.48}px ${w * 0.3}px ${w * 0.3}px / ${h * 0.32}px ${h * 0.32}px ${h * 0.13}px ${h * 0.13}px`,
        })
    }
    return parts
}

type ShellFitters = {
    readonly [T in ShellType]: (
        shell: Extract<DeviceShell, { type: T }>,
        controls: readonly DeviceControl[],
    ) => ShellPart[]
}

const SHELLS: ShellFitters = {
    plate: plateShell,
    mouse: mouseShell,
    gamepad: gamepadShell,
    flightstick: flightstickShell,
}

/** The body parts of `model`, fitted around its controls. */
export function computeShell(model: DeviceModel): ShellPart[] {
    const fit = SHELLS[model.shell.type] as (
        shell: DeviceShell,
        controls: readonly DeviceControl[],
    ) => ShellPart[]
    return fit(model.shell, model.controls)
}

/** A part's px bounding box, approximating the rotated grips. */
function partBoxPx(p: ShellPart): BoxU {
    const [x, y, w, h] = [p.x * DEV_S, p.y * DEV_S, p.w * DEV_S, p.h * DEV_S]
    if (!p.rot) return { x0: x, y0: y, x1: x + w, y1: y + h }
    const dx = Math.sin((Math.abs(p.rot) * Math.PI) / 180) * h
    return p.rot > 0
        ? { x0: x - dx, y0: y, x1: x + w, y1: y + h }
        : { x0: x, y0: y, x1: x + w + dx, y1: y + h }
}

/** Canvas size and origin, kept fixed while a drag is in progress. */
export interface StageFrame {
    W: number
    H: number
    ox: number
    oy: number
}

export interface StageLayout extends StageFrame {
    shell: ShellPart[]
    /** Which side a control's callout sits on. */
    side: (c: DeviceControl) => 'L' | 'R'
}

/** Controls that get a callout (keys are labelled on their caps). */
export const hasCallout = (c: DeviceControl): boolean => c.shape !== 'key'

/** Full canvas layout: shell, size, origin offset and callout sides. Compact
 *  (previews, layout mode) drops the callout gutters. */
export function computeLayout(
    model: DeviceModel,
    opts: { compact?: boolean; frozen?: StageFrame } = {},
): StageLayout {
    const shell = computeShell(model)
    const boxes = [
        ...shell.map(partBoxPx),
        ...model.controls.map((c) => ({
            x0: c.x * DEV_S,
            y0: c.y * DEV_S,
            x1: (c.x + c.w) * DEV_S,
            y1: (c.y + c.h) * DEV_S,
        })),
    ]
    const cb = boxes.reduce<BoxU>(
        (b, k) => ({
            x0: Math.min(b.x0, k.x0),
            y0: Math.min(b.y0, k.y0),
            x1: Math.max(b.x1, k.x1),
            y1: Math.max(b.y1, k.y1),
        }),
        boxes.length ? { ...boxes[0]! } : { x0: 0, y0: 0, x1: 100, y1: 100 },
    )
    const midU = (cb.x0 + cb.x1) / 2 / DEV_S
    const side = (c: DeviceControl): 'L' | 'R' =>
        c.label ?? (c.x + c.w / 2 < midU ? 'L' : 'R')
    if (opts.frozen) return { ...opts.frozen, shell, side }

    const callable = model.controls.filter(hasCallout)
    const nL = callable.filter((c) => side(c) === 'L').length
    const nR = callable.length - nL
    const [cw, ch] = [cb.x1 - cb.x0, cb.y1 - cb.y0]
    const full = CALL_M + CALL_W + CALL_GAP
    const slim = 1.5 * DEV_S
    const sl = opts.compact || !nL ? slim : full
    const sr = opts.compact || !nR ? slim : full
    const H = opts.compact
        ? ch + 4 * DEV_S
        : Math.max(ch + 90, Math.max(nL, nR) * 60 + 30)
    return {
        shell,
        side,
        W: sl + sr + cw,
        H,
        ox: sl - cb.x0,
        oy: (H - ch) / 2 - cb.y0,
    }
}

const round = (): string => '999px'
const pill = (w: number, h: number): string => `${Math.min(w, h) / 2}px`

const RADIUS: Readonly<Record<ControlShape, (w: number, h: number) => string>> =
    {
        round,
        stick: round,
        sensor: round,
        ring: round,
        knob: round,
        hat: round,
        pill,
        wheel: pill,
        trigger: (_w, h) =>
            `${h * 0.55}px ${h * 0.55}px ${h * 0.2}px ${h * 0.2}px`,
        triggerSide: (w) =>
            `${w * 0.55}px ${w * 0.18}px ${w * 0.18}px ${w * 0.55}px`,
        mouseL: (w, h) =>
            `${w * 0.92}px 6px 8px 16px / ${h * 0.72}px 6px 8px 16px`,
        mouseR: (w, h) =>
            `6px ${w * 0.92}px 16px 8px / 6px ${h * 0.72}px 16px 8px`,
        key: (w, h) => `${Math.min(w, h) * 0.16}px`,
        dpad: () => '12px',
        screen: (w, h) => `${Math.min(w, h) * 0.08}px`,
    }

/** Border-radius of a control of `shape` drawn at `w` × `h` px. */
export const controlRadius = (
    shape: ControlShape,
    w: number,
    h: number,
): string => RADIUS[shape](w, h)
