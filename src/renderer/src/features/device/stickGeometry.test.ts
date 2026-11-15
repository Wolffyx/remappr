// Pattern check: no GoF pattern (-) — rejected — unit tests over the pure stick geometry helpers.
import { describe, expect, it } from 'vitest'

import {
    circularityError,
    cornerOf,
    coverage,
    emptyTally,
    normalize,
    reachOf,
    sectorOf,
    SECTORS,
    sweepCal,
    tallyCorner,
    type CornerTally,
    type Vec,
} from './stickGeometry'

const CAL = { min: 0, centre: 2000, max: 4095 }

/** A point `r` out at `deg` degrees (y down, as a gamepad reports). */
const at = (deg: number, r = 1): Vec => ({
    x: r * Math.cos((deg * Math.PI) / 180),
    y: r * Math.sin((deg * Math.PI) / 180),
})

describe('stick geometry', () => {
    it('normalizes each side on its own span, clamped', () => {
        expect(normalize(2000, CAL)).toBe(0)
        expect(normalize(0, CAL)).toBe(-1)
        expect(normalize(4095, CAL)).toBe(1)
        expect(normalize(1000, CAL)).toBe(-0.5)
        expect(normalize(5000, CAL)).toBe(1)
        expect(normalize(10, { min: 10, centre: 10, max: 20 })).toBe(0)
    })

    it('counts directions from +x towards +y', () => {
        expect(sectorOf({ x: 1, y: 0.01 })).toBe(0)
        expect(sectorOf({ x: 0, y: 1 })).toBe(SECTORS / 4)
        expect(sectorOf({ x: -1, y: 0 })).toBe(SECTORS / 2)
        expect(sectorOf({ x: 1, y: -0.01 })).toBe(SECTORS - 1)
    })

    it('keeps the furthest reach each way and how much of the rim it covers', () => {
        const half = Array.from({ length: SECTORS / 2 }, (_, k) =>
            at((k + 0.5) * (360 / SECTORS)),
        )
        const reach = reachOf([...half, at(200, 0.5), at(5, 0.4)])
        expect(reach[0]).toBeCloseTo(1)
        expect(reach[SECTORS / 2 + 1]).toBeCloseTo(0.5)
        expect(coverage(reach)).toBe(0.5)
    })

    it('measures circularity as dualshock-tools does', () => {
        const round = Array.from({ length: SECTORS }, () => 1)
        expect(circularityError(round)).toBe(0)
        const square = Array.from({ length: SECTORS }, (_, k) => {
            const a = ((k + 0.5) * 2 * Math.PI) / SECTORS
            return 1 / Math.max(Math.abs(Math.cos(a)), Math.abs(Math.sin(a)))
        })
        expect(circularityError(square)).toBeGreaterThan(15)
        expect(circularityError([0, 0.1])).toBe(0)
    })

    it('draws a sweep against the last calibration, widened by it', () => {
        const prior = { min: 100, centre: 2040, max: 3900 }
        // Only just begun: noise stays near the centre, not at full.
        const begun = sweepCal({ min: 2032, max: 2049 }, prior)
        expect(begun).toEqual(prior)
        expect(normalize(2032, begun)).toBeCloseTo(-0.004, 3)
        expect(sweepCal({ min: 50, max: 4000 }, prior)).toEqual({
            min: 50,
            centre: 2040,
            max: 4000,
        })
        expect(sweepCal({ min: 1000, max: 3000 }, undefined)).toEqual({
            min: 1000,
            centre: 2000,
            max: 3000,
        })
    })
})

describe('letting go from each corner', () => {
    it('finds the corner a stick is pushed into', () => {
        expect(cornerOf(at(-135))).toBe('ul')
        expect(cornerOf(at(-45))).toBe('ur')
        expect(cornerOf(at(45))).toBe('dr')
        expect(cornerOf(at(135))).toBe('dl')
        expect(cornerOf(at(0))).toBeNull() // straight right
        expect(cornerOf(at(45, 0.3))).toBeNull() // not far enough
    })

    it('ticks a corner once the stick rests after it', () => {
        const feed = (t: CornerTally, v: Vec, now: number): CornerTally =>
            tallyCorner(t, v, now)
        let t = feed(emptyTally(), at(-45), 0)
        expect(t.armed).toBe('ur')
        t = feed(t, at(-45, 0.4), 40) // on its way back
        t = feed(t, { x: 0.02, y: 0.01 }, 80)
        t = feed(t, { x: 0.03, y: 0 }, 200)
        expect(t.done.size).toBe(0) // rested 120 ms
        t = feed(t, { x: 0.03, y: 0 }, 340)
        expect([...t.done]).toEqual(['ur'])
        expect(t.armed).toBeNull()
        // Resting without a corner first ticks nothing.
        t = feed(t, { x: 0, y: 0 }, 1000)
        expect(t.done.size).toBe(1)
    })
})
