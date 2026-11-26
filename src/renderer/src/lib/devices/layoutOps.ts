// Pattern check: no GoF pattern (-) — rejected — pure immutable edit functions over a DeviceModel for the Builder's device layout mode; one caller (deviceBuilderStore).
import { NEW_CONTROL } from '@firmware/devices/stockLayouts'
import type {
    ControlKind,
    DeviceControl,
    DeviceModel,
    DeviceShell,
} from '@firmware/devices/types'
import { KIND_LABEL } from './labels'

/** Snap a key-unit value to the ¼U grid, or to 0.01U when `free`. */
export const snapU = (v: number, free = false): number =>
    free ? Math.round(v * 100) / 100 : Math.round(v * 4) / 4

const round2 = (v: number): number => Math.round(v * 100) / 100

type Writable<T> = { -readonly [K in keyof T]: T[K] }

/** `model` with control `id` changed by `patch`; a field set to undefined is
 *  removed (back to its default). */
export function patchControl(
    model: DeviceModel,
    id: string,
    patch: Partial<Writable<DeviceControl>>,
): DeviceModel {
    return {
        ...model,
        controls: model.controls.map((c) => {
            if (c.id !== id) return c
            const next: Record<string, unknown> = { ...c, ...patch }
            for (const [k, v] of Object.entries(patch)) {
                if (v === undefined) delete next[k]
            }
            return next as unknown as DeviceControl
        }),
    }
}

export function moveControl(
    model: DeviceModel,
    id: string,
    x: number,
    y: number,
): DeviceModel {
    return patchControl(model, id, { x: round2(x), y: round2(y) })
}

/** Move control `id` by (dx, dy) key units. */
export function nudgeControl(
    model: DeviceModel,
    id: string,
    dx: number,
    dy: number,
): DeviceModel {
    const c = model.controls.find((k) => k.id === id)
    return c ? moveControl(model, id, c.x + dx, c.y + dy) : model
}

export function removeControl(model: DeviceModel, id: string): DeviceModel {
    return { ...model, controls: model.controls.filter((c) => c.id !== id) }
}

export function setShell(
    model: DeviceModel,
    patch: Partial<Record<string, number>>,
): DeviceModel {
    return { ...model, shell: { ...model.shell, ...patch } as DeviceShell }
}

function centre(model: DeviceModel): { x: number; y: number } {
    if (!model.controls.length) return { x: 2, y: 2 }
    const xs = model.controls.flatMap((c) => [c.x, c.x + c.w])
    const ys = model.controls.flatMap((c) => [c.y, c.y + c.h])
    return {
        x: (Math.min(...xs) + Math.max(...xs)) / 2,
        y: (Math.min(...ys) + Math.max(...ys)) / 2,
    }
}

/** A free id for another `kind` control: kind1, kind2, … */
function freeId(
    model: DeviceModel,
    kind: ControlKind,
): { id: string; n: number } {
    let n = 1
    while (model.controls.some((c) => c.id === `${kind}${n}`)) n++
    return { id: `${kind}${n}`, n }
}

/** `model` with a new `kind` control in the middle; returns its id too. */
export function addControl(
    model: DeviceModel,
    kind: ControlKind,
): { model: DeviceModel; id: string } {
    const { id, n } = freeId(model, kind)
    const { shape, w, h } = NEW_CONTROL[kind]
    const mid = centre(model)
    const control: DeviceControl = {
        id,
        name: `${KIND_LABEL[kind]} ${n}`,
        kind,
        shape,
        x: snapU(mid.x - w / 2),
        y: snapU(mid.y - h / 2),
        w,
        h,
        ...(model.shell.type === 'flightstick' ? { zone: 'head' } : {}),
    }
    return { model: { ...model, controls: [...model.controls, control] }, id }
}

/** The step R and the Rotate button turn a control by. */
export const CONTROL_ROTATE_STEP = 15

/** Turn control `id` by `deg` about its own centre, kept in (−180, 180]. */
export function rotateControl(
    model: DeviceModel,
    id: string,
    deg: number,
): DeviceModel {
    const c = model.controls.find((k) => k.id === id)
    if (!c) return model
    const r = (((((c.r ?? 0) + deg + 180) % 360) + 360) % 360) - 180
    return patchControl(model, id, { r: r === -180 ? 180 : r || undefined })
}

/** A copy of `c` as a new control of the same kind, named after it and placed
 *  by `place`; its printed marking is dropped (it would read wrong). */
function copyOf(
    model: DeviceModel,
    c: DeviceControl,
    place: (c: DeviceControl) => Partial<Writable<DeviceControl>>,
): { model: DeviceModel; id: string } {
    const { id } = freeId(model, c.kind)
    const copy: Writable<DeviceControl> = {
        ...c,
        id,
        name: `${c.name} copy`,
        ...place(c),
    }
    delete copy.glyph
    if (!copy.r) delete copy.r
    return { model: { ...model, controls: [...model.controls, copy] }, id }
}

/** A copy of control `id` a quarter unit down and right; returns its id. */
export function duplicateControl(
    model: DeviceModel,
    id: string,
): { model: DeviceModel; id: string } | null {
    const c = model.controls.find((k) => k.id === id)
    if (!c) return null
    return copyOf(model, c, (k) => ({ x: k.x + 0.25, y: k.y + 0.25 }))
}

const MIRROR_TOL = 0.25

/** Which side of the device's centre line control `id` would mirror to, or
 *  null when it sits on the line. */
export function mirrorSide(
    model: DeviceModel,
    id: string,
): 'left' | 'right' | null {
    const c = model.controls.find((k) => k.id === id)
    if (!c) return null
    const d = c.x + c.w / 2 - centre(model).x
    if (Math.abs(d) < MIRROR_TOL) return null
    return d < 0 ? 'right' : 'left'
}

/** A copy of control `id` on the other side of the device's centre line,
 *  rotation mirrored. Null when it sits on the line or the spot is taken. */
export function mirrorControl(
    model: DeviceModel,
    id: string,
): { model: DeviceModel; id: string } | null {
    const c = model.controls.find((k) => k.id === id)
    if (!c || !mirrorSide(model, id)) return null
    const axis = centre(model).x
    const x = round2(2 * axis - c.x - c.w)
    const cx = x + c.w / 2
    const cy = c.y + c.h / 2
    const taken = model.controls.some(
        (k) =>
            Math.abs(k.x + k.w / 2 - cx) < MIRROR_TOL &&
            Math.abs(k.y + k.h / 2 - cy) < MIRROR_TOL,
    )
    if (taken) return null
    return copyOf(model, c, (k) => ({ x, r: k.r ? -k.r : 0 }))
}
