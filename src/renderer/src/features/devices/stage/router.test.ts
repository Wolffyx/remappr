// pattern-check: skip — unit tests for the leader-line router.
import { describe, expect, it } from 'vitest'
import {
    STOCK_FLIGHTSTICK,
    STOCK_GAMEPAD,
    STOCK_MOUSE,
} from '@firmware/devices/stockLayouts'
import type { DeviceModel } from '@firmware/devices/types'
import { routeCallouts } from './callouts'
import { computeLayout, hasCallout } from './geometry'
import {
    CLEAR,
    footprint,
    outlineDistance,
    overlaps,
    ports,
    roundedPath,
    TIP,
    type Footprint,
    type Pt,
} from './router'

const model = (
    m: Pick<DeviceModel, 'shell' | 'controls'>,
    form: DeviceModel['form'],
): DeviceModel => ({ kind: 'mouse', form, name: 'T', ...m })

const STOCK: [string, DeviceModel][] = [
    ['gamepad', model(STOCK_GAMEPAD, 'gamepad')],
    ['mouse', model(STOCK_MOUSE, 'mouse')],
    ['flight stick', model(STOCK_FLIGHTSTICK, 'flightstick')],
]

/** Every coordinate pair of a path, bends' control points included. */
const points = (d: string): Pt[] => {
    const n = (d.match(/-?\d+(\.\d+)?/g) ?? []).map(Number)
    return Array.from({ length: n.length / 2 }, (_, i) => [
        n[2 * i]!,
        n[2 * i + 1]!,
    ])
}

/** Points every 2 px along the polyline. */
const samples = (pts: readonly Pt[]): Pt[] =>
    pts.slice(1).flatMap((b, i) => {
        const a = pts[i]!
        const k = Math.max(
            1,
            Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 2),
        )
        return Array.from(
            { length: k },
            (_, j): Pt => [
                a[0] + ((b[0] - a[0]) * j) / k,
                a[1] + ((b[1] - a[1]) * j) / k,
            ],
        )
    })

const cross = (a: Pt, b: Pt, c: Pt, d: Pt): boolean => {
    const o = (p: Pt, q: Pt, r: Pt): number =>
        Math.sign((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]))
    return o(a, b, c) * o(a, b, d) < 0 && o(c, d, a) * o(c, d, b) < 0
}

const circle: Footprint = { cx: 100, cy: 100, hw: 20, hh: 20, rr: 20, rot: 0 }

describe('ports', () => {
    it('puts four ports on the centre axes and four at 45° on the corners', () => {
        const ps = ports(circle)
        expect(ps.slice(0, 4).map((p) => [p.x, p.y])).toEqual([
            [120, 100],
            [100, 120],
            [80, 100],
            [100, 80],
        ])
        expect(ps.slice(0, 4).every((p) => !p.diag)).toBe(true)
        for (const p of ps.slice(4)) {
            expect(p.diag).toBe(true)
            expect(Math.hypot(p.x - 100, p.y - 100)).toBeCloseTo(20)
            expect(Math.abs(p.nx)).toBeCloseTo(Math.SQRT1_2)
        }
    })

    it('treats every port of a rotated control as angled', () => {
        expect(ports({ ...circle, rot: 0.3 }).every((p) => p.diag)).toBe(true)
    })

    it('knows a control that sits on another', () => {
        const wheel: Footprint = {
            cx: 118,
            cy: 100,
            hw: 6,
            hh: 15,
            rr: 6,
            rot: 0,
        }
        expect(overlaps(wheel, circle)).toBe(true)
        expect(overlaps({ ...wheel, cx: 160 }, circle)).toBe(false)
    })

    it('lets an axis port leave only straight out', () => {
        expect(
            ports(circle)
                .slice(0, 4)
                .map((p) => p.dirs),
        ).toEqual([[0], [1], [2], [3]])
    })
})

describe('outlineDistance', () => {
    it('is negative inside, zero on the outline, positive outside', () => {
        expect(outlineDistance(circle, 100, 100)).toBeCloseTo(-20)
        expect(outlineDistance(circle, 120, 100)).toBeCloseTo(0)
        expect(outlineDistance(circle, 130, 100)).toBeCloseTo(10)
    })
})

describe('roundedPath', () => {
    it('rounds each bend with a quadratic', () => {
        expect(
            roundedPath([
                [0, 0],
                [20, 0],
                [20, 20],
            ]),
        ).toBe('M0 0 L14 0 Q20 0 20 6 L20 20')
    })
})

describe.each(STOCK)('routed leader lines (%s)', (_name, m) => {
    const L = computeLayout(m)
    const routes = routeCallouts(m, L)
    const feet = new Map(m.controls.map((c) => [c.id, footprint(c, L)]))
    const callable = m.controls.filter(hasCallout)

    it('routes every control that has a callout', () => {
        expect(Object.keys(routes).sort()).toEqual(
            callable.map((c) => c.id).sort(),
        )
    })

    it('never runs under or over another control', () => {
        for (const r of Object.values(routes))
            for (const [x, y] of samples(points(r.d)))
                for (const [id, f] of feet) {
                    if (id === r.id || overlaps(feet.get(r.id)!, f)) continue
                    expect(outlineDistance(f, x, y)).toBeGreaterThan(CLEAR - 3)
                }
    })

    it('stops just short of its own control, on a port', () => {
        for (const r of Object.values(routes)) {
            const f = feet.get(r.id)!
            const end = points(r.d).at(-1)!
            expect(outlineDistance(f, ...end)).toBeCloseTo(TIP, 0)
            const onPort = ports(f).some(
                (p) =>
                    Math.hypot(
                        p.x + p.nx * TIP - end[0],
                        p.y + p.ny * TIP - end[1],
                    ) < 0.2,
            )
            expect(onPort).toBe(true)
        }
    })

    it('leaves an axis port along the control centre line', () => {
        for (const r of Object.values(routes)) {
            const f = feet.get(r.id)!
            if (f.rot) continue
            const [end, before] = [points(r.d).at(-1)!, points(r.d).at(-2)!]
            const onX =
                Math.abs(end[0] - f.cx) < 0.1 &&
                Math.abs(before[0] - f.cx) < 0.1
            const onY =
                Math.abs(end[1] - f.cy) < 0.1 &&
                Math.abs(before[1] - f.cy) < 0.1
            const corner =
                Math.abs(Math.abs(end[0] - f.cx) - Math.abs(end[1] - f.cy)) <
                    1 &&
                !onX &&
                !onY
            expect(onX || onY || corner).toBe(true)
        }
    })

    it('never crosses another line', () => {
        const segs = Object.values(routes).map((r) => {
            const p = points(r.d)
            return p.slice(1).map((b, i): [Pt, Pt] => [p[i]!, b])
        })
        segs.forEach((a, i) =>
            segs.slice(i + 1).forEach((b) => {
                for (const [p, q] of a)
                    for (const [r, s] of b)
                        expect(cross(p, q, r, s)).toBe(false)
            }),
        )
    })

    it('keeps cards on a side at least 60px apart', () => {
        for (const side of ['L', 'R']) {
            const ys = Object.values(routes)
                .filter((r) => r.side === side)
                .map((r) => r.y)
                .sort((a, b) => a - b)
            ys.slice(1).forEach((y, i) =>
                expect(y - ys[i]!).toBeGreaterThan(59.999),
            )
        }
    })
})
