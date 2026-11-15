// Pattern check: no GoF pattern (-) — rejected — presentational test view over useStickTest's trace; no firmware calls.
//
// Testing a calibration (after dualshock-tools' circularity test): roll each
// stick round its edge and its output traces how far it reaches every way;
// directions that fall short of full are marked. Zoomed in on the centre, the
// stick's recent readings show how it settles against the inner deadzone.
import { JSX, useState } from 'react'
import type { AxisConfig, AxisState, JoystickStick } from '@firmware/service'

import { Button } from '@/ui/button'

import { StickDial } from './StickDial'
import { SECTORS } from './stickGeometry'
import {
    inputOf,
    outputOf,
    type StickTrace,
    type TraceStats,
} from './useStickTest'

/** The centre view shows a tenth of the travel across the dial. */
const ZOOM = 10
const RADIAL = 1 << 1

/** The inner deadzone stick `st` is shaped with: its X input's, round when
 *  both inputs are radial. */
function innerOf(
    config: AxisConfig | null,
    st: JoystickStick,
): { size: number; round: boolean } | undefined {
    const x = config?.axes[st.x]
    const y = config?.axes[st.y]
    if (!x || !y) return undefined
    return { size: x.inner / 100, round: (x.flags & y.flags & RADIAL) !== 0 }
}

function summary(s: TraceStats | undefined): string {
    if (!s || s.swept === 0) return 'Roll the stick round its edge'
    return `Full in ${s.full} of ${SECTORS} directions · circularity ${s.circularity.toFixed(1)}%`
}

export function StickTest({
    sticks,
    config,
    state,
    trace,
    stats,
    onClear,
}: {
    sticks: readonly JoystickStick[]
    config: AxisConfig | null
    state: AxisState | null
    trace: StickTrace
    stats: readonly TraceStats[]
    onClear: () => void
}): JSX.Element {
    const [zoomed, setZoomed] = useState(false)
    const cal = config?.axes ?? []
    return (
        <div className="flex flex-col gap-3 rounded-md border border-border p-3">
            <div>
                <p className="text-sm font-medium">Test</p>
                <p className="text-xs text-muted-foreground">
                    {zoomed
                        ? 'Let the stick go a few times: its dots should settle inside the red inner deadzone.'
                        : 'Roll the stick slowly round its edge: the trace should reach the rim every way. Red marks fall short of full.'}
                </p>
            </div>
            <div className="flex flex-wrap gap-6">
                {sticks.map((st, k) => (
                    <div
                        key={st.controlId}
                        className="flex flex-col items-center gap-1"
                    >
                        {zoomed ? (
                            <StickDial
                                zoom={ZOOM}
                                dot={
                                    state ? inputOf(state, st, cal) : undefined
                                }
                                cloud={trace.cloud[k]}
                                inner={innerOf(config, st)}
                            />
                        ) : (
                            <StickDial
                                dot={state ? outputOf(state, st) : undefined}
                                trace={trace.reach[k]}
                            />
                        )}
                        <span className="text-xs">{st.name}</span>
                        <span className="font-mono text-caption text-muted-foreground tabular-nums">
                            {zoomed
                                ? `Centre, ${ZOOM}× zoom`
                                : summary(stats[k])}
                        </span>
                    </div>
                ))}
            </div>
            <div className="flex gap-2">
                <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setZoomed((z) => !z)}
                >
                    {zoomed ? 'Whole travel' : 'Zoom on the centre'}
                </Button>
                <Button size="sm" variant="ghost" onClick={onClear}>
                    Clear
                </Button>
            </div>
        </div>
    )
}
