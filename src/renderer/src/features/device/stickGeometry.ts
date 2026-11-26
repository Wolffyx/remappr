// Pattern check: no GoF pattern (-) — rejected — pure geometry helpers (normalize, sectors, reach, corners, circularity) for the stick dials; plain functions.
//
// The joystick panel's stick maths, apart from React so it is tested: where a
// reading sits against a calibration, which way it points, how far a stick
// has been pushed each way, which corners it was let go from, and how round
// its output is (dualshock-tools' circularity test).

export interface Vec {
    readonly x: number
    readonly y: number
}

/** An input's raw calibration: both ends and the rest position. */
export interface CalRange {
    readonly min: number
    readonly centre: number
    readonly max: number
}

/** Directions a dial is divided into. */
export const SECTORS = 32
/** How far out a direction must be pushed to count as reaching the rim. */
export const RIM_EDGE = 0.85
/** Output this far out counts as full. */
export const FULL_EDGE = 0.98

const TAU = 2 * Math.PI

/** `raw` against `cal`: -1 at min, 0 at the centre, 1 at max (clamped), each
 *  side scaled on its own span, as the firmware does. */
export function normalize(raw: number, cal: CalRange): number {
    const span = raw >= cal.centre ? cal.max - cal.centre : cal.centre - cal.min
    if (span <= 0) return 0
    return Math.max(-1, Math.min(1, (raw - cal.centre) / span))
}

export const radius = (v: Vec): number => Math.hypot(v.x, v.y)

/** The direction `v` points, 0..sectors-1, counted from +x towards +y. */
export function sectorOf(v: Vec, sectors = SECTORS): number {
    const a = (Math.atan2(v.y, v.x) + TAU) % TAU
    return Math.floor(a / (TAU / sectors)) % sectors
}

/** The furthest `points` reach in each direction (0 = never that way). */
export function reachOf(points: readonly Vec[], sectors = SECTORS): number[] {
    const reach = new Array<number>(sectors).fill(0)
    for (const p of points) {
        const s = sectorOf(p, sectors)
        reach[s] = Math.max(reach[s]!, radius(p))
    }
    return reach
}

/** The share of directions pushed at least `edge` out, 0..1. */
export function coverage(reach: readonly number[], edge = RIM_EDGE): number {
    if (reach.length === 0) return 0
    return reach.filter((r) => r >= edge).length / reach.length
}

/** How far from round the output is: the RMS of (reach - 1) over the
 *  directions pushed past 0.2, in %. 0 when there are none. */
export function circularityError(reach: readonly number[]): number {
    const swept = reach.filter((r) => r > 0.2)
    if (swept.length === 0) return 0
    const sq = swept.reduce((acc, r) => acc + (r - 1) ** 2, 0)
    return Math.sqrt(sq / swept.length) * 100
}

/** The calibration a sweep in progress is drawn against: the last one
 *  (`prior`), widened by the range seen so far. Not the range seen alone: a
 *  side not yet pushed would span a few counts, and its noise would read as
 *  full deflection. With no prior, the range seen, centred. */
export function sweepCal(
    seen: { readonly min: number; readonly max: number },
    prior: CalRange | undefined,
): CalRange {
    if (!prior)
        return {
            min: seen.min,
            centre: (seen.min + seen.max) / 2,
            max: seen.max,
        }
    return {
        min: Math.min(prior.min, seen.min),
        centre: prior.centre,
        max: Math.max(prior.max, seen.max),
    }
}

// ---- letting go from each corner ----------------------------------------------

export type Corner = 'ul' | 'ur' | 'dl' | 'dr'
export const CORNERS: readonly Corner[] = ['ul', 'ur', 'dl', 'dr']

/** Pushed at least this far into a corner arms it. */
const CORNER_REACH = 0.6
/** Back within this of the centre is resting. */
const REST_RADIUS = 0.15
/** Resting this long (ms) after a corner ticks it. */
const REST_MS = 250

/** Which corner `v` is pushed into (y down), or null when it is not near a
 *  diagonal or not far enough out. */
export function cornerOf(v: Vec): Corner | null {
    const ax = Math.abs(v.x)
    const ay = Math.abs(v.y)
    if (radius(v) < CORNER_REACH || Math.min(ax, ay) < 0.5 * Math.max(ax, ay))
        return null
    const vertical = v.y < 0 ? 'u' : 'd'
    const horizontal = v.x < 0 ? 'l' : 'r'
    return `${vertical}${horizontal}` as Corner
}

/** One stick's let-go tally: the corners done, the one it was last pushed
 *  into, and since when it has rested. */
export interface CornerTally {
    readonly done: ReadonlySet<Corner>
    readonly armed: Corner | null
    readonly restSince: number | null
}

export const emptyTally = (): CornerTally => ({
    done: new Set(),
    armed: null,
    restSince: null,
})

/** The tally after the stick reads `v` at `now` ms: pushed into a corner arms
 *  it; let go and resting for REST_MS ticks it. */
export function tallyCorner(t: CornerTally, v: Vec, now: number): CornerTally {
    const corner = cornerOf(v)
    if (corner) return { ...t, armed: corner, restSince: null }
    if (!t.armed || radius(v) > REST_RADIUS) return { ...t, restSince: null }
    const since = t.restSince ?? now
    if (now - since < REST_MS) return { ...t, restSince: since }
    return {
        done: new Set(t.done).add(t.armed),
        armed: null,
        restSince: null,
    }
}
