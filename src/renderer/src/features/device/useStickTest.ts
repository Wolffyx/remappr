// Pattern check: no GoF pattern (-) — rejected — a hook folding live readings into the test view's trace and rest cloud; pure step plus useState.
//
// The stick test (after dualshock-tools' circularity test): rolled round its
// edge, how far each stick's output reaches every way; let go, where its
// input settles against the inner deadzone (the recent readings, drawn
// zoomed in).
import { useCallback, useMemo, useState } from 'react'
import type { AxisState, JoystickStick } from '@firmware/service'

import {
    circularityError,
    FULL_EDGE,
    normalize,
    radius,
    SECTORS,
    sectorOf,
    type CalRange,
    type Vec,
} from './stickGeometry'

const FULL = 32767
/** Recent input readings kept per stick for the rest cloud. */
const CLOUD = 60

export interface StickTrace {
    /** Per stick: the furthest output each way. */
    readonly reach: readonly (readonly number[])[]
    /** Per stick: the latest input readings, -1..1. */
    readonly cloud: readonly (readonly Vec[])[]
}

export const emptyTrace = (sticks: number): StickTrace => ({
    reach: Array.from({ length: sticks }, () =>
        new Array<number>(SECTORS).fill(0),
    ),
    cloud: Array.from({ length: sticks }, () => []),
})

/** Stick `st`'s output in `sample`, -1..1 each way. */
export const outputOf = (sample: AxisState, st: JoystickStick): Vec => ({
    x: (sample.inputs[st.x]?.value ?? 0) / FULL,
    y: (sample.inputs[st.y]?.value ?? 0) / FULL,
})

/** Stick `st`'s input in `sample` against its calibration `cal` (per input). */
export function inputOf(
    sample: AxisState,
    st: JoystickStick,
    cal: readonly (CalRange | undefined)[],
): Vec | undefined {
    const cx = cal[st.x]
    const cy = cal[st.y]
    const rx = sample.inputs[st.x]?.raw
    const ry = sample.inputs[st.y]?.raw
    if (!cx || !cy || rx === undefined || ry === undefined) return undefined
    return { x: normalize(rx, cx), y: normalize(ry, cy) }
}

function widenReach(reach: readonly number[], v: Vec): number[] {
    const out = [...reach]
    const s = sectorOf(v)
    out[s] = Math.max(out[s] ?? 0, radius(v))
    return out
}

/** The trace after one live reading. */
export function traceStep(
    t: StickTrace,
    sample: AxisState,
    sticks: readonly JoystickStick[],
    cal: readonly (CalRange | undefined)[],
): StickTrace {
    return {
        reach: sticks.map((st, k) =>
            widenReach(t.reach[k] ?? [], outputOf(sample, st)),
        ),
        cloud: sticks.map((st, k) => {
            const v = inputOf(sample, st, cal)
            const prev = t.cloud[k] ?? []
            return v ? [...prev, v].slice(-CLOUD) : prev
        }),
    }
}

/** What a stick's trace says: the share of directions its output reached
 *  full, and how far from round it is (%). */
export interface TraceStats {
    readonly full: number
    readonly swept: number
    readonly circularity: number
}

export function traceStats(reach: readonly number[]): TraceStats {
    return {
        full: reach.filter((r) => r >= FULL_EDGE).length,
        swept: reach.filter((r) => r > 0.2).length,
        circularity: circularityError(reach),
    }
}

export function useStickTest(
    sticks: readonly JoystickStick[],
    cal: readonly (CalRange | undefined)[],
): {
    trace: StickTrace
    stats: readonly TraceStats[]
    feed: (sample: AxisState) => void
    clear: () => void
} {
    const [trace, setTrace] = useState<StickTrace>(() =>
        emptyTrace(sticks.length),
    )
    const feed = useCallback(
        (sample: AxisState) =>
            setTrace((t) => traceStep(t, sample, sticks, cal)),
        [sticks, cal],
    )
    const clear = useCallback(
        () => setTrace(emptyTrace(sticks.length)),
        [sticks.length],
    )
    const stats = useMemo(() => trace.reach.map(traceStats), [trace])
    return { trace, stats, feed, clear }
}
