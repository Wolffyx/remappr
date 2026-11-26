// Pattern check: no GoF pattern (-) — rejected — presentational SVG dial; geometry lives in stickGeometry.ts.
//
// One stick drawn as a dial (y down, as a gamepad reports): where it is now,
// and, as the calibration and test views need, how far it has been pushed
// each way (a coverage ring while sweeping, a trace while testing), the four
// corners to let it go from, the inner deadzone and recent positions near the
// centre (zoomed in).
import type { JSX } from 'react'

import {
    CORNERS,
    FULL_EDGE,
    RIM_EDGE,
    SECTORS,
    type Corner,
    type Vec,
} from './stickGeometry'

/** Drawn travel radius in view units; the view runs to ±EDGE. */
const R = 100
const EDGE = 118
const CORNER_AT: Readonly<Record<Corner, Vec>> = {
    ul: { x: -0.7, y: -0.7 },
    ur: { x: 0.7, y: -0.7 },
    dl: { x: -0.7, y: 0.7 },
    dr: { x: 0.7, y: 0.7 },
}

const mix = (pct: number, color = 'var(--foreground)'): string =>
    `color-mix(in oklab, ${color} ${pct}%, transparent)`

/** A point of the dial, `v` scaled by `zoom` and kept on the view. */
function place(v: Vec, zoom: number): Vec {
    const x = v.x * zoom * R
    const y = v.y * zoom * R
    const d = Math.hypot(x, y)
    const k = d > EDGE - 4 ? (EDGE - 4) / d : 1
    return { x: x * k, y: y * k }
}

/** The wedge of direction `s` between radii `r0` and `r1`. */
function wedge(s: number, r0: number, r1: number): string {
    const a0 = (s * 2 * Math.PI) / SECTORS
    const a1 = ((s + 1) * 2 * Math.PI) / SECTORS
    const p = (r: number, a: number): string =>
        `${(r * Math.cos(a)).toFixed(1)} ${(r * Math.sin(a)).toFixed(1)}`
    return `M ${p(r0, a0)} L ${p(r1, a0)} A ${r1} ${r1} 0 0 1 ${p(r1, a1)} L ${p(r0, a1)} A ${r0} ${r0} 0 0 0 ${p(r0, a0)} Z`
}

function CoverageRing({ reach }: { reach: readonly number[] }): JSX.Element {
    return (
        <g>
            {reach.map((r, s) => (
                <path
                    key={s}
                    d={wedge(s, R + 4, R + 14)}
                    fill={r >= RIM_EDGE ? 'var(--primary)' : mix(10)}
                    stroke="var(--card)"
                    strokeWidth={1}
                />
            ))}
        </g>
    )
}

/** How far the stick reached each way, joined up; the ways it fell short of
 *  full are marked on the rim. */
function Trace({ reach }: { reach: readonly number[] }): JSX.Element {
    const pts = reach
        .map((r, s) => {
            const a = ((s + 0.5) * 2 * Math.PI) / SECTORS
            const d = Math.min(r, EDGE / R) * R
            return `${(d * Math.cos(a)).toFixed(1)},${(d * Math.sin(a)).toFixed(1)}`
        })
        .join(' ')
    return (
        <g>
            <polygon
                points={pts}
                fill={mix(14, 'var(--primary)')}
                stroke="var(--primary)"
                strokeWidth={1.5}
            />
            {reach.map((r, s) =>
                r > 0.2 && r < FULL_EDGE ? (
                    <path
                        key={s}
                        d={wedge(s, R + 4, R + 10)}
                        fill="var(--destructive)"
                    />
                ) : null,
            )}
        </g>
    )
}

function Corners({
    done,
    armed,
}: {
    done: ReadonlySet<Corner>
    armed: Corner | null
}): JSX.Element {
    return (
        <g>
            {CORNERS.map((c) => {
                const p = CORNER_AT[c]
                const ticked = done.has(c)
                return (
                    <g key={c} transform={`translate(${p.x * R} ${p.y * R})`}>
                        <circle
                            r={11}
                            fill={ticked ? 'var(--primary)' : 'var(--card)'}
                            stroke={
                                armed === c ? 'var(--primary)' : 'var(--border)'
                            }
                            strokeWidth={armed === c ? 3 : 1.5}
                        />
                        {ticked ? (
                            <path
                                d="M -5 0 L -1.5 4 L 5 -4"
                                fill="none"
                                stroke="var(--primary-foreground)"
                                strokeWidth={2.2}
                            />
                        ) : null}
                    </g>
                )
            })}
        </g>
    )
}

/** The inner deadzone, round or per axis (a square), at `zoom`. */
function InnerZone({
    inner,
    round,
    zoom,
}: {
    inner: number
    round: boolean
    zoom: number
}): JSX.Element | null {
    const r = Math.min(inner * zoom, EDGE / R) * R
    if (r <= 0) return null
    const style = {
        fill: mix(22, 'var(--destructive)'),
        stroke: mix(60, 'var(--destructive)'),
        strokeWidth: 1,
    }
    return round ? (
        <circle r={r} {...style} />
    ) : (
        <rect x={-r} y={-r} width={2 * r} height={2 * r} {...style} />
    )
}

export function StickDial({
    dot,
    coverage,
    trace,
    corners,
    inner,
    cloud,
    zoom = 1,
    size = 168,
}: {
    /** Where the stick is, -1..1 each way (y down). */
    dot?: Vec
    /** Furthest reach each way while sweeping (coverage ring). */
    coverage?: readonly number[]
    /** Furthest output each way while testing (trace). */
    trace?: readonly number[]
    corners?: { done: ReadonlySet<Corner>; armed: Corner | null }
    /** The inner deadzone, a fraction of travel. */
    inner?: { size: number; round: boolean }
    /** Recent positions, drawn faint (the jitter at rest). */
    cloud?: readonly Vec[]
    /** 1 = the whole travel; 10 = a tenth of it fills the dial. */
    zoom?: number
    size?: number
}): JSX.Element {
    const p = dot ? place(dot, zoom) : null
    return (
        <svg
            width={size}
            height={size}
            viewBox={`${-EDGE} ${-EDGE} ${2 * EDGE} ${2 * EDGE}`}
            className="shrink-0"
            role="img"
            aria-label="Stick position"
        >
            <circle r={R} fill="var(--secondary)" stroke="var(--border)" />
            <line x1={-R} x2={R} y1={0} y2={0} stroke="var(--border)" />
            <line y1={-R} y2={R} x1={0} x2={0} stroke="var(--border)" />
            {coverage ? <CoverageRing reach={coverage} /> : null}
            {inner ? (
                <InnerZone inner={inner.size} round={inner.round} zoom={zoom} />
            ) : null}
            {trace ? <Trace reach={trace} /> : null}
            {corners ? <Corners {...corners} /> : null}
            {(cloud ?? []).map((c, i) => {
                const q = place(c, zoom)
                return (
                    <circle
                        key={i}
                        cx={q.x}
                        cy={q.y}
                        r={1.8}
                        fill={mix(35, 'var(--primary)')}
                    />
                )
            })}
            {p ? (
                <circle
                    cx={p.x}
                    cy={p.y}
                    r={6}
                    fill="var(--primary)"
                    stroke="var(--card)"
                    strokeWidth={2}
                />
            ) : null}
        </svg>
    )
}
