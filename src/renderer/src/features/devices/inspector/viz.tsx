// Pattern check: no GoF pattern (-) — rejected — presentational visualisations of analog settings (response curve, stick deadzone, trigger travel); maths lives in lib/devices/curves.ts.
import type { JSX } from 'react'
import type { ResponseCurve } from '@firmware/devices/types'
import { curveAt, curveSamples } from '@/lib/devices/curves'

const W = 288
const H = 120

/** The response curve with its deadzone band and, in live view, the current
 *  deflection as a dot. */
export function CurveGraph({
    curve,
    dz = 0,
    max = 100,
    pos,
}: {
    curve: ResponseCurve
    dz?: number
    max?: number
    /** Live deflection 0..1, or undefined. */
    pos?: number
}): JSX.Element {
    const pts = curveSamples(curve, dz, max)
        .map(([x, y]) => `${(x * W).toFixed(1)},${(H - y * H).toFixed(1)}`)
        .join(' ')
    const px = pos === undefined ? null : Math.min(1, Math.abs(pos))
    return (
        <svg
            width="100%"
            viewBox={`0 0 ${W} ${H}`}
            className="block rounded-lg border border-border bg-secondary"
        >
            {[0.25, 0.5, 0.75].map((g) => (
                <g key={g} stroke="var(--border)">
                    <line x1={g * W} x2={g * W} y1={0} y2={H} />
                    <line y1={g * H} y2={g * H} x1={0} x2={W} />
                </g>
            ))}
            {dz > 0 ? (
                <rect
                    x={0}
                    y={0}
                    width={(dz / 100) * W}
                    height={H}
                    fill="color-mix(in oklch, var(--destructive) 14%, transparent)"
                />
            ) : null}
            <line
                x1={0}
                y1={H}
                x2={W}
                y2={0}
                stroke="color-mix(in oklch, var(--foreground) 18%, transparent)"
                strokeDasharray="3 4"
            />
            <polyline
                points={pts}
                fill="none"
                stroke="var(--primary)"
                strokeWidth={2.2}
            />
            {px !== null ? (
                <circle
                    cx={px * W}
                    cy={H - curveAt(curve, px, dz, max) * H}
                    r={4.5}
                    fill="var(--primary)"
                    stroke="var(--card)"
                    strokeWidth={2}
                />
            ) : null}
        </svg>
    )
}

/** The stick's travel circle: inner deadzone, outer saturation ring, live dot.
 *  Round deadzones act on the stick's distance from centre; per-axis ones
 *  (round false) make a square. */
export function DeadzoneViz({
    inner,
    outer,
    round = true,
    pos,
}: {
    inner: number
    outer: number
    round?: boolean
    pos?: { x: number; y: number }
}): JSX.Element {
    const S = 132
    const p = pos ?? { x: 0, y: 0 }
    const shape = round ? 'rounded-full' : 'rounded-[3px]'
    return (
        <div
            className="relative shrink-0 rounded-full border border-border bg-secondary"
            style={{ width: S, height: S }}
        >
            <div className="absolute inset-y-2 left-1/2 w-px bg-border" />
            <div className="absolute inset-x-2 top-1/2 h-px bg-border" />
            <div
                className={`absolute ${shape} border-[1.5px] border-dashed border-primary/70`}
                style={{ inset: `${(100 - outer) / 2}%` }}
            />
            <div
                className={`absolute ${shape} border border-destructive/60 bg-destructive/25`}
                style={{ inset: `${50 - inner / 2}%` }}
            />
            <div
                className="absolute top-1/2 left-1/2 -m-1.5 size-3 rounded-full bg-primary shadow-[0_0_12px_var(--primary)] transition-transform duration-300"
                style={{
                    transform: `translate(${p.x * S * 0.42}px, ${p.y * S * 0.42}px)`,
                }}
            />
        </div>
    )
}

/** Trigger travel: dead start, the live pull, the full-press point. */
export function TriggerViz({
    start,
    end,
    value = 0,
}: {
    start: number
    end: number
    value?: number
}): JSX.Element {
    return (
        <div>
            <div className="relative h-[26px] overflow-hidden rounded-[7px] border border-border bg-secondary">
                <div
                    className="absolute inset-y-0 left-0"
                    style={{
                        width: `${start}%`,
                        background:
                            'repeating-linear-gradient(135deg, color-mix(in oklch, var(--destructive) 22%, transparent) 0 4px, transparent 4px 8px)',
                    }}
                />
                <div
                    className="absolute inset-y-0 right-0"
                    style={{
                        width: `${100 - end}%`,
                        background:
                            'repeating-linear-gradient(135deg, color-mix(in oklch, var(--foreground) 12%, transparent) 0 4px, transparent 4px 8px)',
                    }}
                />
                <div
                    className="absolute inset-y-0 left-0 bg-primary/45 transition-[width] duration-200"
                    style={{ width: `${value * 100}%` }}
                />
                {[start, end].map((p, i) => (
                    <div
                        key={i}
                        className="absolute inset-y-0 -ml-px w-0.5 bg-primary"
                        style={{ left: `${p}%` }}
                    />
                ))}
            </div>
            <div className="mt-[5px] flex justify-between font-mono text-[10.5px] text-muted-foreground">
                <span>released</span>
                <span>{Math.round(value * 100)}%</span>
                <span>full pull</span>
            </div>
        </div>
    )
}
