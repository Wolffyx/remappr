// Pattern check: no GoF pattern (-) — rejected — RouteGrid is a stateful grid + A* search (plain data structure); corner radii use a Dispatch Map (Tier 0) keyed on ControlShape, like geometry.ts RADIUS.
//
// Leader-line router of the device stage. Every control is a rounded box with
// eight ports on its outline (the ends of its centre axes, and the 45° points
// of its corners). A line leaves its control from a port and runs on a 6 px
// grid with right-angle bends, keeping clear of every other control and of the
// lines routed before it. Pure apart from the grid's own bookkeeping.
import type { ControlShape, DeviceControl } from '@firmware/devices/types'
import { DEV_S, type StageLayout } from './geometry'

export type Pt = [number, number]

/** Grid step, px. */
export const STEP = 6
/** Clearance kept from every control, px. */
export const CLEAR = 5
/** Gap left between a line's end and its control's outline, px. */
export const TIP = 2

/** Right, down, left, up. */
const DIRS: readonly Pt[] = [
    [1, 0],
    [0, 1],
    [-1, 0],
    [0, -1],
]
const TURN_COST = 6
const NEAR_COST = 1.5
const SHARED_COST = 60
/** Corner ports are used only when every axis port is blocked or far worse. */
const CORNER_COST = 30

/** A control's footprint on the canvas: a rounded box, px. */
export interface Footprint {
    cx: number
    cy: number
    hw: number
    hh: number
    /** Corner radius. */
    rr: number
    /** Clockwise rotation, radians. */
    rot: number
}

const fullRound = (w: number, h: number): number => Math.min(w, h) / 2

const CORNER: Readonly<Record<ControlShape, (w: number, h: number) => number>> =
    {
        round: fullRound,
        stick: fullRound,
        sensor: fullRound,
        ring: fullRound,
        knob: fullRound,
        hat: fullRound,
        pill: fullRound,
        wheel: fullRound,
        trigger: (_w, h) => h * 0.4,
        triggerSide: (w) => w * 0.4,
        mouseL: (w, h) => Math.min(w, h) * 0.3,
        mouseR: (w, h) => Math.min(w, h) * 0.3,
        key: (w, h) => Math.min(w, h) * 0.16,
        dpad: () => 12,
        screen: (w, h) => Math.min(w, h) * 0.08,
    }

export function footprint(c: DeviceControl, L: StageLayout): Footprint {
    const [w, h] = [c.w * DEV_S, c.h * DEV_S]
    return {
        cx: L.ox + (c.x + c.w / 2) * DEV_S,
        cy: L.oy + (c.y + c.h / 2) * DEV_S,
        hw: w / 2,
        hh: h / 2,
        rr: Math.min(CORNER[c.shape](w, h), fullRound(w, h)),
        rot: ((c.r ?? 0) * Math.PI) / 180,
    }
}

/** Signed distance from (x, y) to the footprint's outline; negative inside. */
export function outlineDistance(f: Footprint, x: number, y: number): number {
    const [cos, sin] = [Math.cos(f.rot), Math.sin(f.rot)]
    const [dx, dy] = [x - f.cx, y - f.cy]
    const lx = dx * cos + dy * sin
    const ly = -dx * sin + dy * cos
    const qx = Math.abs(lx) - (f.hw - f.rr)
    const qy = Math.abs(ly) - (f.hh - f.rr)
    return (
        Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) +
        Math.min(Math.max(qx, qy), 0) -
        f.rr
    )
}

/** True when `a` sits partly on `b` (a scroll wheel on the mouse buttons):
 *  `a`'s centre or one of its ports lies inside `b`. */
export function overlaps(a: Footprint, b: Footprint): boolean {
    return [
        [a.cx, a.cy] as const,
        ...ports(a).map((p) => [p.x, p.y] as const),
    ].some(([x, y]) => outlineDistance(b, x, y) < 0)
}

export interface Port {
    /** On the outline. */
    x: number
    y: number
    /** Outward unit normal. */
    nx: number
    ny: number
    /** Grid directions a line may leave in. */
    dirs: number[]
    /** Leaves at an angle (a corner port, or any port of a rotated control). */
    diag: boolean
}

const Q = Math.SQRT1_2

/** The eight ports: axis ends first, then the 45° corner points. */
export function ports(f: Footprint): Port[] {
    const [ix, iy] = [f.hw - f.rr, f.hh - f.rr]
    const local: [number, number, number, number][] = [
        [f.hw, 0, 1, 0],
        [0, f.hh, 0, 1],
        [-f.hw, 0, -1, 0],
        [0, -f.hh, 0, -1],
        ...[
            [1, 1],
            [-1, 1],
            [-1, -1],
            [1, -1],
        ].map(([sx, sy]): [number, number, number, number] => [
            sx! * (ix + f.rr * Q),
            sy! * (iy + f.rr * Q),
            sx! * Q,
            sy! * Q,
        ]),
    ]
    const [cos, sin] = [Math.cos(f.rot), Math.sin(f.rot)]
    const square = Math.abs(Math.sin(2 * f.rot)) < 1e-6
    return local.map(([lx, ly, lnx, lny], k) => {
        const nx = lnx * cos - lny * sin
        const ny = lnx * sin + lny * cos
        return {
            x: f.cx + lx * cos - ly * sin,
            y: f.cy + lx * sin + ly * cos,
            nx,
            ny,
            dirs: DIRS.flatMap((d, i) =>
                d[0] * nx + d[1] * ny > 0.2 ? [i] : [],
            ),
            diag: k >= 4 || !square,
        }
    })
}

/** Binary min-heap of [priority, state]. */
class MinHeap {
    private readonly items: [number, number][] = []

    get size(): number {
        return this.items.length
    }

    push(f: number, s: number): void {
        const a = this.items
        a.push([f, s])
        for (let i = a.length - 1; i > 0; ) {
            const p = (i - 1) >> 1
            if (a[p]![0] <= a[i]![0]) return
            ;[a[p], a[i]] = [a[i]!, a[p]!]
            i = p
        }
    }

    pop(): number {
        const a = this.items
        const top = a[0]!
        const last = a.pop()!
        if (!a.length) return top[1]
        a[0] = last
        for (let i = 0; ; ) {
            const [l, r] = [2 * i + 1, 2 * i + 2]
            let m = i
            if (l < a.length && a[l]![0] < a[m]![0]) m = l
            if (r < a.length && a[r]![0] < a[m]![0]) m = r
            if (m === i) return top[1]
            ;[a[m], a[i]] = [a[i]!, a[m]!]
            i = m
        }
    }
}

/** A finished route, control → gutter. */
export interface OutRoute {
    /** Starts TIP px off the port, ends on the gutter column. */
    pts: Pt[]
    port: Port
}

export class RouteGrid {
    readonly cols: number
    readonly rows: number
    /** Index of the control a cell lies on (with clearance), -1 when free. */
    private readonly owner: Int16Array
    /** Free cells touching a wall: lines prefer the middle of a gap. */
    private readonly near: Uint8Array
    /** Index of the control whose line took a cell, -1 when untaken. */
    private readonly usedBy: Int16Array
    /** Controls the routed control sits on: its line may cross them. */
    private hosts: ReadonlySet<number> = new Set()

    constructor(
        width: number,
        height: number,
        private readonly feet: readonly Footprint[],
    ) {
        this.cols = Math.ceil(width / STEP)
        this.rows = Math.ceil(height / STEP)
        const n = this.cols * this.rows
        this.owner = new Int16Array(n).fill(-1)
        this.near = new Uint8Array(n)
        this.usedBy = new Int16Array(n).fill(-1)
        feet.forEach((f, fi) => this.paint(f, fi))
        for (let i = 0; i < n; i++)
            this.near[i] =
                this.owner[i] === -1 &&
                this.neighbours(i).some((j) => this.owner[j] !== -1)
                    ? 1
                    : 0
    }

    private paint(f: Footprint, fi: number): void {
        const reach = Math.max(f.hw, f.hh) + CLEAR + STEP
        const [gx0, gx1] = [this.col(f.cx - reach), this.col(f.cx + reach)]
        const [gy0, gy1] = [this.row(f.cy - reach), this.row(f.cy + reach)]
        for (let gy = gy0; gy <= gy1; gy++)
            for (let gx = gx0; gx <= gx1; gx++) {
                const i = gy * this.cols + gx
                if (this.owner[i] !== -1) continue
                if (outlineDistance(f, ...this.centre(i)) <= CLEAR)
                    this.owner[i] = fi
            }
    }

    private col(x: number): number {
        return Math.min(this.cols - 1, Math.max(0, Math.floor(x / STEP)))
    }

    private row(y: number): number {
        return Math.min(this.rows - 1, Math.max(0, Math.floor(y / STEP)))
    }

    centre(i: number): Pt {
        return [
            (i % this.cols) * STEP + STEP / 2,
            Math.floor(i / this.cols) * STEP + STEP / 2,
        ]
    }

    /** Open to the line being routed: no control, or only one it sits on. */
    private free(i: number): boolean {
        return this.owner[i] === -1 || this.hosts.has(this.owner[i]!)
    }

    private step(i: number, d: number): number {
        const gx = (i % this.cols) + DIRS[d]![0]
        const gy = Math.floor(i / this.cols) + DIRS[d]![1]
        if (gx < 0 || gy < 0 || gx >= this.cols || gy >= this.rows) return -1
        return gy * this.cols + gx
    }

    private neighbours(i: number): number[] {
        return [0, 1, 2, 3].map((d) => this.step(i, d)).filter((j) => j >= 0)
    }

    /** Routes control `fi` out to the column at canvas x `gutterX`, and
     *  reserves the cells it took. Null when every port is walled in. */
    route(fi: number, gutterX: number): OutRoute | null {
        const goal = this.col(gutterX)
        const own = this.feet[fi]!
        this.hosts = new Set(
            this.feet.flatMap((f, j) =>
                j !== fi && overlaps(own, f) ? [j] : [],
            ),
        )
        const seeds = this.seeds(fi)
        const found = this.search(seeds, goal)
        if (!found) return null
        const { cells, port } = found
        cells.forEach((i) => (this.usedBy[i] = fi))
        const pts = cells.map((i) => this.centre(i))
        if (!port.diag) snapAxisRun(pts, port, this.feet[fi]!)
        return {
            pts: [[port.x + port.nx * TIP, port.y + port.ny * TIP], ...pts],
            port,
        }
    }

    /** First free cell straight out from each port, with its start cost. */
    private seeds(fi: number): Map<number, Port> {
        const out = new Map<number, Port>()
        for (const p of ports(this.feet[fi]!)) {
            const reach = CLEAR + STEP
            const i =
                this.row(p.y + p.ny * reach) * this.cols +
                this.col(p.x + p.nx * reach)
            if (!this.free(i) || out.has(i)) continue
            out.set(i, p)
        }
        return out
    }

    /** A* over (cell, heading) states from the seeds to the goal column. */
    private search(
        seeds: Map<number, Port>,
        goal: number,
    ): { cells: number[]; port: Port } | null {
        const n = this.cols * this.rows * 4
        const g = new Float64Array(n).fill(Infinity)
        const prev = new Int32Array(n).fill(-1)
        const heap = new MinHeap()
        const h = (i: number): number => Math.abs((i % this.cols) - goal)
        seeds.forEach((p, i) =>
            p.dirs.forEach((d) => {
                const s = i * 4 + d
                g[s] = p.diag ? CORNER_COST : 0
                heap.push(g[s] + h(i), s)
            }),
        )
        while (heap.size) {
            const s = heap.pop()
            const cell = s >> 2
            if (cell % this.cols === goal) return this.unwind(s, prev, seeds)
            this.expand(s, g, prev, (f, ns) => heap.push(f + h(ns >> 2), ns))
        }
        return null
    }

    private expand(
        s: number,
        g: Float64Array,
        prev: Int32Array,
        push: (cost: number, state: number) => void,
    ): void {
        const [cell, d] = [s >> 2, s & 3]
        for (let nd = 0; nd < 4; nd++) {
            if (nd === (d + 2) % 4) continue
            const nc = this.step(cell, nd)
            if (nc < 0 || !this.free(nc)) continue
            const cost =
                g[s]! +
                1 +
                (nd !== d ? TURN_COST : 0) +
                this.near[nc]! * NEAR_COST +
                (this.usedBy[nc] !== -1 ? SHARED_COST : 0)
            const ns = nc * 4 + nd
            if (cost >= g[ns]!) continue
            g[ns] = cost
            prev[ns] = s
            push(cost, ns)
        }
    }

    private unwind(
        end: number,
        prev: Int32Array,
        seeds: Map<number, Port>,
    ): { cells: number[]; port: Port } {
        const cells: number[] = []
        let first = end
        for (let s = end; s >= 0; s = prev[s]!) {
            cells.push(s >> 2)
            first = s
        }
        return { cells: cells.reverse(), port: seeds.get(first >> 2)! }
    }

    /** True when the straight run (x0,y0)–(x1,y1) crosses no control (other
     *  than `fi`) and no other line. */
    clear(fi: number, a: Pt, b: Pt): boolean {
        const [gx0, gx1] = [
            this.col(Math.min(a[0], b[0])),
            this.col(Math.max(a[0], b[0])),
        ]
        const [gy0, gy1] = [
            this.row(Math.min(a[1], b[1])),
            this.row(Math.max(a[1], b[1])),
        ]
        for (let gy = gy0; gy <= gy1; gy++)
            for (let gx = gx0; gx <= gx1; gx++) {
                const i = gy * this.cols + gx
                if (this.owner[i] !== -1 && this.owner[i] !== fi) return false
                if (this.usedBy[i] !== -1 && this.usedBy[i] !== fi) return false
            }
        return true
    }
}

/** An axis port's first leg runs on the control's centre line: the grid cells
 *  sit up to half a step off it, so the leading straight run is moved onto it. */
function snapAxisRun(pts: Pt[], port: Port, f: Footprint): void {
    const k = port.nx !== 0 ? 1 : 0
    const line = k === 1 ? f.cy : f.cx
    const run = pts[0]?.[k]
    for (let j = 0; j < pts.length && pts[j]![k] === run; j++) pts[j]![k] = line
}

/** Drops the middle of every straight run, keeping only the bends. */
export function simplify(pts: readonly Pt[]): Pt[] {
    return pts.filter((p, i) => {
        if (i === 0 || i === pts.length - 1) return true
        const [a, b] = [pts[i - 1]!, pts[i + 1]!]
        const vertical = a[0] === p[0] && p[0] === b[0]
        const horizontal = a[1] === p[1] && p[1] === b[1]
        return !vertical && !horizontal
    })
}

/** SVG path through `pts` with each bend rounded by up to `r` px. */
export function roundedPath(pts: readonly Pt[], r = 6): string {
    const f = (n: number): string => String(Math.round(n * 10) / 10)
    const [x0, y0] = pts[0]!
    let d = `M${f(x0)} ${f(y0)}`
    for (let i = 1; i < pts.length - 1; i++) {
        const [[px, py], [x, y], [nx, ny]] = [pts[i - 1]!, pts[i]!, pts[i + 1]!]
        const l1 = Math.hypot(x - px, y - py)
        const l2 = Math.hypot(nx - x, ny - y)
        const k = Math.min(r, l1 / 2, l2 / 2)
        const [ax, ay] = [x - ((x - px) / l1) * k, y - ((y - py) / l1) * k]
        const [bx, by] = [x + ((nx - x) / l2) * k, y + ((ny - y) / l2) * k]
        d += ` L${f(ax)} ${f(ay)} Q${f(x)} ${f(y)} ${f(bx)} ${f(by)}`
    }
    const [xl, yl] = pts[pts.length - 1]!
    return `${d} L${f(xl)} ${f(yl)}`
}
