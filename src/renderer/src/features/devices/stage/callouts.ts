// Pattern check: no GoF pattern (-) — rejected — two pure layout functions (anchor points, vertical stacking) with one caller, the device stage.
//
// Callout placement: every non-key control gets a label card on the left or
// right gutter, joined to the control by a leader line. Cards on a side are
// stacked top to bottom near their control's height, never closer than GAP.
import type { DeviceModel } from '@firmware/devices/types'
import { DEV_S, hasCallout, type StageLayout } from './geometry'

/** Card height and the minimum distance between two cards on a side. */
export const CALLOUT_H = 50
const GAP = 60
const EDGE = 12

export interface CalloutAnchor {
    id: string
    side: 'L' | 'R'
    /** The control's centre on the canvas, px. */
    ax: number
    ay: number
}

/** Where each callout's leader line starts: the centre of its control. */
export function calloutAnchors(
    model: DeviceModel,
    layout: StageLayout,
): CalloutAnchor[] {
    return model.controls.filter(hasCallout).map((c) => ({
        id: c.id,
        side: layout.side(c),
        ax: layout.ox + (c.x + c.w / 2) * DEV_S,
        ay: layout.oy + (c.y + c.h / 2) * DEV_S,
    }))
}

/** Top y of each card on one side: as close to its anchor as the stack allows,
 *  pulled back up when the stack would run off the bottom of a `height` canvas. */
export function stackCallouts(
    anchors: readonly Pick<CalloutAnchor, 'id' | 'ay'>[],
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

/** Card tops for both sides of the canvas. */
export function layoutCallouts(
    anchors: readonly CalloutAnchor[],
    height: number,
): Record<string, number> {
    return {
        ...stackCallouts(
            anchors.filter((a) => a.side === 'L'),
            height,
        ),
        ...stackCallouts(
            anchors.filter((a) => a.side === 'R'),
            height,
        ),
    }
}
