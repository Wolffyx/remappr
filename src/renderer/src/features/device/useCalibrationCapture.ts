// Pattern check: no GoF pattern (-) — rejected — a hook folding live samples into the guided calibration's progress (rim coverage, corners); a pure step plus useState.
//
// What the guided calibration shows while the stick captures (the firmware
// keeps its own record; this only guides the hand): how much of each stick's
// rim has been pushed round, and which corners it has been let go from. A
// sweep in progress is drawn against the last calibration, widened by the
// range seen so far.
import { useCallback, useMemo, useState } from 'react'
import type { AxisState, JoystickStick } from '@firmware/service'

import {
    coverage,
    emptyTally,
    normalize,
    reachOf,
    sweepCal,
    tallyCorner,
    type CalRange,
    type CornerTally,
    type Vec,
} from './stickGeometry'

/** The guided steps: push round the rim, then let go from each corner. */
export type GuidePhase = 'rim' | 'rests'

/** Rim readings kept per stick (the latest). */
const MAX_POINTS = 2000

interface Seen {
    readonly min: number
    readonly max: number
}

export interface Capture {
    /** Per input: the raw range seen since the capture began. */
    readonly seen: readonly (Seen | undefined)[]
    /** Per stick: the raw (x, y) readings while rounding the rim. */
    readonly points: readonly (readonly Vec[])[]
    /** Per stick: the corners let go from. */
    readonly tallies: readonly CornerTally[]
}

export const emptyCapture = (sticks: number): Capture => ({
    seen: [],
    points: Array.from({ length: sticks }, () => []),
    tallies: Array.from({ length: sticks }, emptyTally),
})

/** Each input's last calibration, where it has one. */
export type Priors = readonly (CalRange | undefined)[]

/** Input `i`'s calibration for drawing the sweep so far. */
function calOf(seen: Capture['seen'], i: number, priors: Priors): CalRange {
    const prior = priors[i]
    const s = seen[i] ?? prior ?? { min: 0, max: 1 }
    return sweepCal(s, prior)
}

/** Stick `st`'s raw reading in `sample`. */
const rawOf = (sample: AxisState, st: JoystickStick): Vec => ({
    x: sample.inputs[st.x]?.raw ?? 0,
    y: sample.inputs[st.y]?.raw ?? 0,
})

/** A raw (x, y) against the sweep so far, -1..1 each way. */
export function sweepPos(
    raw: Vec,
    st: JoystickStick,
    seen: Capture['seen'],
    priors: Priors,
): Vec {
    return {
        x: normalize(raw.x, calOf(seen, st.x, priors)),
        y: normalize(raw.y, calOf(seen, st.y, priors)),
    }
}

function widen(seen: Capture['seen'], sample: AxisState): Seen[] {
    return sample.inputs.map(({ raw }, i) => {
        const s = seen[i]
        return s
            ? { min: Math.min(s.min, raw), max: Math.max(s.max, raw) }
            : { min: raw, max: raw }
    })
}

/** The capture after one live reading, in phase `phase` at `now` ms. */
export function captureStep(
    c: Capture,
    sample: AxisState,
    ctx: {
        readonly phase: GuidePhase
        readonly sticks: readonly JoystickStick[]
        readonly priors: Priors
        readonly now: number
    },
): Capture {
    const seen = widen(c.seen, sample)
    const { phase, sticks, priors, now } = ctx
    const points =
        phase !== 'rim'
            ? c.points
            : sticks.map((st, k) =>
                  [...(c.points[k] ?? []), rawOf(sample, st)].slice(
                      -MAX_POINTS,
                  ),
              )
    const tallies =
        phase !== 'rests'
            ? c.tallies
            : sticks.map((st, k) =>
                  tallyCorner(
                      c.tallies[k] ?? emptyTally(),
                      sweepPos(rawOf(sample, st), st, seen, priors),
                      now,
                  ),
              )
    return { seen, points, tallies }
}

/** One stick's progress: how far it reached each way, the share of the rim
 *  covered and the corners let go from. */
export interface StickProgress {
    readonly reach: readonly number[]
    readonly covered: number
    readonly tally: CornerTally
}

export function useCalibrationCapture(
    sticks: readonly JoystickStick[],
    priors: Priors,
): {
    progress: readonly StickProgress[]
    /** Where each stick is in `sample`, against the sweep so far. */
    posOf: (sample: AxisState | null) => readonly (Vec | undefined)[]
    restart: () => void
    feed: (sample: AxisState, phase: GuidePhase) => void
} {
    const [cap, setCap] = useState<Capture>(() => emptyCapture(sticks.length))
    const restart = useCallback(
        () => setCap(emptyCapture(sticks.length)),
        [sticks.length],
    )
    const feed = useCallback(
        (sample: AxisState, phase: GuidePhase) =>
            setCap((c) =>
                captureStep(c, sample, {
                    phase,
                    sticks,
                    priors,
                    now: performance.now(),
                }),
            ),
        [sticks, priors],
    )
    const progress = useMemo(
        () =>
            sticks.map((st, k): StickProgress => {
                const reach = reachOf(
                    (cap.points[k] ?? []).map((p) =>
                        sweepPos(p, st, cap.seen, priors),
                    ),
                )
                return {
                    reach,
                    covered: coverage(reach),
                    tally: cap.tallies[k] ?? emptyTally(),
                }
            }),
        [cap, sticks, priors],
    )
    const posOf = useCallback(
        (sample: AxisState | null) =>
            sticks.map((st) =>
                sample
                    ? sweepPos(rawOf(sample, st), st, cap.seen, priors)
                    : undefined,
            ),
        [cap.seen, sticks, priors],
    )
    return { progress, posOf, restart, feed }
}
