// Pattern check: no GoF pattern (-) — rejected — pure layout functions (card stacking, lane assignment, path assembly) with one caller, the device stage; routing lives in router.ts.
//
// Callout placement: every non-key control gets a label card on the left or
// right gutter, joined to the control by a leader line. Each line is routed
// first, from one of its control's ports out to the gutter, around every other
// control; the cards on a side are then stacked in the order their lines reach
// the gutter, so no two lines cross.
import type { DeviceControl, DeviceModel } from '@firmware/devices/types'
import {
    CALL_GAP,
    CALL_M,
    CALL_W,
    hasCallout,
    type StageLayout,
} from './geometry'
import {
    footprint,
    ports,
    roundedPath,
    RouteGrid,
    simplify,
    STEP,
    TIP,
    type OutRoute,
    type Pt,
} from './router'

/** Card height and the minimum distance between two cards on a side. */
export const CALLOUT_H = 50
const GAP = 60
const EDGE = 12
/** Where lines meet the gutter column, measured from the card's inner edge. */
const GUTTER_IN = CALL_GAP - 10
/** Spacing of the lanes that carry a line up or down to its card. */
const LANE = 7
const MAX_LANES = 6

/** Top y of each card on one side: as close to `ay` (where its line wants the
 *  card's middle) as the stack allows, pulled back up when the stack would run
 *  off the bottom of a `height` canvas. */
export function stackCallouts(
    anchors: readonly { id: string; ay: number }[],
    height: number,
): Record<string, number> {
    const sorted = [...anchors].sort((a, b) => a.ay - b.ay)
    let prev = -Infinity
    const ys = sorted.map((a) => {
        const y = Math.max(a.ay - CALLOUT_H / 2, prev + GAP)
        prev = y
        return y
    })
    const over = ys.length
        ? ys[ys.length - 1]! + CALLOUT_H - (height - EDGE)
        : 0
    for (let i = ys.length - 1; over > 0 && i >= 0; i--) {
        const limit =
            i === ys.length - 1
                ? ys[i]! - over
                : Math.min(ys[i]!, ys[i + 1]! - GAP)
        ys[i] = Math.max(EDGE + i * GAP, limit)
    }
    return Object.fromEntries(sorted.map((a, i) => [a.id, ys[i]!]))
}

export interface CalloutRoute {
    id: string
    side: 'L' | 'R'
    /** Card top, px. */
    y: number
    /** Leader line, card edge → control, as an SVG path. */
    d: string
}

interface Sided {
    c: DeviceControl
    fi: number
    side: 'L' | 'R'
}

/** Card inner edge and gutter column x for a side. */
function edges(side: 'L' | 'R', width: number): { card: number; gut: number } {
    const card = side === 'L' ? CALL_M + CALL_W : width - CALL_M - CALL_W
    return { card, gut: side === 'L' ? card + GUTTER_IN : card - GUTTER_IN }
}

/** Cards and routed leader lines for every control that has a callout. */
export function routeCallouts(
    model: DeviceModel,
    L: StageLayout,
): Record<string, CalloutRoute> {
    const feet = model.controls.map((c) => footprint(c, L))
    const grid = new RouteGrid(L.W, L.H, feet)
    const list: Sided[] = model.controls.flatMap((c, fi) =>
        hasCallout(c) ? [{ c, fi, side: L.side(c) }] : [],
    )
    const outs = new Map<string, OutRoute>()
    const reach = (s: Sided): number =>
        Math.abs(edges(s.side, L.W).gut - feet[s.fi]!.cx)
    for (const s of [...list].sort((a, b) => reach(a) - reach(b))) {
        const r = grid.route(s.fi, edges(s.side, L.W).gut)
        if (r) outs.set(s.c.id, r)
    }
    const want = (s: Sided): number =>
        outs.get(s.c.id)?.pts.at(-1)?.[1] ?? feet[s.fi]!.cy
    const ys: Record<string, number> = {}
    for (const side of ['L', 'R'] as const) {
        const own = list.filter((s) => s.side === side)
        Object.assign(
            ys,
            stackCallouts(
                own.map((s) => ({ id: s.c.id, ay: want(s) })),
                L.H,
            ),
        )
    }
    const mid = (s: Sided): number => ys[s.c.id]! + CALLOUT_H / 2
    const lanes = assignLanes(list, outs, mid, L.W)
    return Object.fromEntries(
        list.map((s) => {
            const out = outs.get(s.c.id)
            const pts = out
                ? joinCard(s, out, mid(s), lanes.get(s.c.id), grid, L.W)
                : fallback(s, feet[s.fi]!, mid(s), L.W)
            return [
                s.c.id,
                {
                    id: s.c.id,
                    side: s.side,
                    y: ys[s.c.id]!,
                    d: roundedPath(pts),
                },
            ]
        }),
    )
}

/** One lane per line that has to step up or down between its card and the
 *  gutter. Lines going down take the outer lanes top-first and lines going up
 *  bottom-first, so a lane never crosses a neighbour's bend. */
function assignLanes(
    list: readonly Sided[],
    outs: ReadonlyMap<string, OutRoute>,
    mid: (s: Sided) => number,
    width: number,
): Map<string, number> {
    const lanes = new Map<string, number>()
    const port = (s: Sided): number => outs.get(s.c.id)!.pts.at(-1)![1]
    for (const side of ['L', 'R'] as const) {
        const own = list.filter((s) => s.side === side && outs.has(s.c.id))
        const down = own
            .filter((s) => port(s) > mid(s) + 0.5)
            .sort((a, b) => mid(a) - mid(b))
        const up = own
            .filter((s) => port(s) < mid(s) - 0.5)
            .sort((a, b) => mid(b) - mid(a))
        const { card } = edges(side, width)
        const dir = side === 'L' ? 1 : -1
        for (const group of [down, up])
            group.forEach((s, k) =>
                lanes.set(
                    s.c.id,
                    card +
                        dir * (GUTTER_IN - 6 - Math.min(k, MAX_LANES) * LANE),
                ),
            )
    }
    return lanes
}

/** Full line, card → control: the card's stub and lane, then the routed path
 *  walked back from the gutter to the control. */
function joinCard(
    s: Sided,
    out: OutRoute,
    y: number,
    lane: number | undefined,
    grid: RouteGrid,
    width: number,
): Pt[] {
    const back = level(s.fi, simplify([...out.pts].reverse()), y, grid)
    const { card } = edges(s.side, width)
    const py = back[0]![1]
    const head: Pt[] =
        lane === undefined || Math.abs(py - y) < 0.5
            ? [[card, py]]
            : [
                  [card, y],
                  [lane, y],
                  [lane, py],
              ]
    return simplify([...head, ...back])
}

/** Moves the route's last horizontal leg to the card's height when that leg
 *  can run there freely, so the line meets the card without a step. Only legs
 *  after a bend move: a line's first leg stays on its control's centre line. */
function level(fi: number, back: Pt[], y: number, grid: RouteGrid): Pt[] {
    if (back.length < 3 || Math.abs(back[0]![1] - y) < 0.5) return back
    const [b0, b1, b2] = [back[0]!, back[1]!, back[2]!]
    if (b0[1] !== b1[1] || b1[0] !== b2[0]) return back
    // A vertical first leg may shorten, but never into its own control.
    const last = back.length === 3
    if (last && (y - b2[1]) * Math.sign(b1[1] - b2[1]) < STEP) return back
    const free =
        grid.clear(fi, [b1[0], b1[1]], [b1[0], y]) &&
        grid.clear(fi, [b1[0], y], [b0[0], y])
    return free ? [[b0[0], y], [b1[0], y], ...back.slice(2)] : back
}

/** No free path out (a control walled in by others): a straight line from the
 *  card's stub to the nearest port. */
function fallback(
    s: Sided,
    f: ReturnType<typeof footprint>,
    y: number,
    width: number,
): Pt[] {
    const { card } = edges(s.side, width)
    const stub: Pt = [card + (s.side === 'L' ? 24 : -24), y]
    const p = ports(f).reduce((a, b) =>
        Math.hypot(b.x - stub[0], b.y - y) < Math.hypot(a.x - stub[0], a.y - y)
            ? b
            : a,
    )
    return [[card, y], stub, [p.x + p.nx * TIP, p.y + p.ny * TIP]]
}
