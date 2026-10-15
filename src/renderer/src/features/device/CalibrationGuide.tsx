// Pattern check: no GoF pattern (-) — rejected — presentational guide for the two capture steps; no firmware calls.
//
// What the hand does while the stick captures (after dualshock-tools' range
// and centre wizards): push it round the rim until the ring is full, then let
// it go from each corner so the centre is the middle of where it comes to
// rest, not wherever it stopped last.
import type { JSX } from 'react'
import type { JoystickStick } from '@firmware/service'

import { StickDial } from './StickDial'
import type { Vec } from './stickGeometry'
import type { GuidePhase, StickProgress } from './useCalibrationCapture'

const STEP: Readonly<Record<GuidePhase, { title: string; body: string }>> = {
    rim: {
        title: '1 · Push it round the rim',
        body: 'Push the stick to its edge and roll it slowly all the way round, twice each way. The ring fills as you go.',
    },
    rests: {
        title: '2 · Let it go from each corner',
        body: 'Push the stick into a corner and let it snap back to the middle. Each corner ticks once the stick has settled; do all four.',
    },
}

function statusOf(phase: GuidePhase, p: StickProgress): string {
    if (phase === 'rim') return `Rim covered ${Math.round(p.covered * 100)}%`
    return `Corners ${p.tally.done.size} of 4`
}

export function CalibrationGuide({
    phase,
    sticks,
    progress,
    pos,
}: {
    phase: GuidePhase
    sticks: readonly JoystickStick[]
    progress: readonly StickProgress[]
    pos: readonly (Vec | undefined)[]
}): JSX.Element {
    const step = STEP[phase]
    return (
        <div className="flex flex-col gap-3 rounded-md border border-border p-3">
            <div>
                <p className="text-sm font-medium">{step.title}</p>
                <p className="text-xs text-muted-foreground">{step.body}</p>
            </div>
            <div className="flex flex-wrap gap-6">
                {sticks.map((st, k) => {
                    const p = progress[k]
                    if (!p) return null
                    return (
                        <div
                            key={st.controlId}
                            className="flex flex-col items-center gap-1"
                        >
                            <StickDial
                                dot={pos[k]}
                                coverage={phase === 'rim' ? p.reach : undefined}
                                corners={
                                    phase === 'rests'
                                        ? {
                                              done: p.tally.done,
                                              armed: p.tally.armed,
                                          }
                                        : undefined
                                }
                            />
                            <span className="text-xs">{st.name}</span>
                            <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
                                {statusOf(phase, p)}
                            </span>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
