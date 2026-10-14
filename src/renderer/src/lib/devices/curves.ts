// Pattern check: Dispatch Map (Tier 0) — applied — response-curve name → easing function table, one entry per curve.
//
// Response-curve maths for analog sticks and axes: the shape the inspector
// draws and the live dot it places on it.
import type { ResponseCurve } from '@firmware/devices/types'

const CURVES: Readonly<Record<ResponseCurve, (x: number) => number>> = {
    linear: (x) => x,
    aggressive: (x) => Math.pow(x, 0.55),
    relaxed: (x) => Math.pow(x, 1.9),
    precise: (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2),
}

const clamp01 = (v: number): number => Math.min(1, Math.max(0, v))

/** Output (0..1) for a deflection `x` (0..1) through `curve`, with a deadzone
 *  of `dz` percent and full output at `max` percent. */
export function curveAt(
    curve: ResponseCurve,
    x: number,
    dz = 0,
    max = 100,
): number {
    const pct = clamp01(x) * 100
    if (pct <= dz) return 0
    if (pct >= max) return 1
    return clamp01(CURVES[curve]((pct - dz) / (max - dz)))
}

/** `n + 1` evenly spaced [x, y] samples of the curve, both in 0..1. */
export function curveSamples(
    curve: ResponseCurve,
    dz = 0,
    max = 100,
    n = 40,
): [number, number][] {
    return Array.from({ length: n + 1 }, (_, i) => {
        const x = i / n
        return [x, curveAt(curve, x, dz, max)]
    })
}
