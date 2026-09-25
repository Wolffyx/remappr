// pattern-check: skip — pure/JSX helpers extracted verbatim from KeyboardView
import { HidUsageLabel } from '../HidUsageLabel'
import type { KeyPosition } from '../PhysicalLayoutCanvas'
import type { HoldTapLabels } from '../KeyButton'
import type { ResolvedHoldTapDescriptor } from '@firmware'

type Direction = 'left' | 'right' | 'up' | 'down'

// Per-direction proximity metric. Given the delta to a candidate key it returns
// {primary, cross} distances, or null when the candidate is not in that direction
// (the 0.1 dead-band ignores keys on the same axis). Cross distance is weighted
// 2× by the caller so the nearest in-line key wins. A table keeps the four cases
// symmetric and side-by-side instead of an if-ladder.
const DIR_METRIC: Record<
    Direction,
    (dx: number, dy: number) => { primary: number; cross: number } | null
> = {
    left: (dx, dy) =>
        dx >= -0.1 ? null : { primary: -dx, cross: Math.abs(dy) },
    right: (dx, dy) =>
        dx <= 0.1 ? null : { primary: dx, cross: Math.abs(dy) },
    up: (dx, dy) => (dy >= -0.1 ? null : { primary: -dy, cross: Math.abs(dx) }),
    down: (dx, dy) => (dy <= 0.1 ? null : { primary: dy, cross: Math.abs(dx) }),
}

/** Nearest key (by centre geometry) to `from` in a direction; null if none. */
export function neighborInDirection(
    positions: KeyPosition[],
    from: number,
    dir: Direction,
): number | null {
    const a = positions[from]
    if (!a || a.knob) return null
    const acx = a.x + a.width / 2
    const acy = a.y + a.height / 2
    const metric = DIR_METRIC[dir]
    let best: number | null = null
    let bestScore = Infinity
    positions.forEach((p, i) => {
        if (i === from || p.knob) return
        const m = metric(p.x + p.width / 2 - acx, p.y + p.height / 2 - acy)
        if (!m) return
        const score = m.primary + m.cross * 2
        if (score < bestScore) {
            bestScore = score
            best = i
        }
    })
    return best
}

export function holdTapToLabels(
    desc: ResolvedHoldTapDescriptor,
): HoldTapLabels {
    const tap = (
        <HidUsageLabel
            hid_usage={desc.tapParam}
            header={desc.actionTypeName}
            hideMods
        />
    )
    const hold =
        desc.holdNodeKind === 'layer' ? (
            <span>{desc.holdLayerMomentary}</span>
        ) : (
            <HidUsageLabel hid_usage={desc.holdParam} />
        )
    return { tap, hold, tooltip: desc.tooltip }
}
