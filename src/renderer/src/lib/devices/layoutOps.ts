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

/** `model` with a new `kind` control in the middle; returns its id too. */
export function addControl(
    model: DeviceModel,
    kind: ControlKind,
): { model: DeviceModel; id: string } {
    let n = 1
    while (model.controls.some((c) => c.id === `${kind}${n}`)) n++
    const id = `${kind}${n}`
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
