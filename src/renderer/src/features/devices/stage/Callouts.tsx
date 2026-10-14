// Pattern check: no GoF pattern (-) — rejected — presentational callout layer (leader lines, anchor dots, label cards); layout maths lives in callouts.ts.
import type { JSX } from 'react'
import type { DeviceControl } from '@firmware/devices/types'
import type { BindingSummary } from '@/lib/devices/bindingSummary'
import { categoryAccent } from '@/lib/devices/deviceCategory'
import { cn } from '@/lib/cn'
import { CALLOUT_H, type CalloutAnchor } from './callouts'
import { CALL_M, CALL_W } from './geometry'

interface CalloutLayerProps {
    anchors: readonly CalloutAnchor[]
    ys: Readonly<Record<string, number>>
    width: number
    height: number
    active: (id: string) => boolean
}

/** Leader lines from each card's inner edge to its control. Drawn under the
 *  controls so a line never crosses a face. */
export function CalloutLines({
    anchors,
    ys,
    width,
    height,
    active,
}: CalloutLayerProps): JSX.Element {
    return (
        <svg
            width={width}
            height={height}
            className="pointer-events-none absolute inset-0"
        >
            {anchors.map((a) => {
                const y = (ys[a.id] ?? 0) + CALLOUT_H / 2
                const left = a.side === 'L'
                const x0 = left ? CALL_M + CALL_W : width - CALL_M - CALL_W
                const ex = left ? x0 + 24 : x0 - 24
                const on = active(a.id)
                return (
                    <polyline
                        key={a.id}
                        points={`${x0},${y} ${ex},${y} ${a.ax},${a.ay}`}
                        fill="none"
                        stroke={
                            on
                                ? 'var(--primary)'
                                : 'color-mix(in oklch, var(--foreground) 22%, transparent)'
                        }
                        strokeWidth={on ? 1.6 : 1}
                    />
                )
            })}
        </svg>
    )
}

/** The anchor dots, drawn over the controls. */
export function CalloutDots({
    anchors,
    width,
    height,
    active,
}: Omit<CalloutLayerProps, 'ys'>): JSX.Element {
    return (
        <svg
            width={width}
            height={height}
            className="pointer-events-none absolute inset-0"
        >
            {anchors.map((a) => {
                const on = active(a.id)
                return (
                    <circle
                        key={a.id}
                        cx={a.ax}
                        cy={a.ay}
                        r={on ? 3.5 : 2.5}
                        fill={on ? 'var(--primary)' : 'var(--foreground)'}
                        opacity={on ? 1 : 0.55}
                    />
                )
            })}
        </svg>
    )
}

interface CalloutProps {
    control: DeviceControl
    side: 'L' | 'R'
    y: number
    summary: BindingSummary
    selected: boolean
    hovered: boolean
    mono: boolean
    onSelect: (id: string) => void
    onHover: (id: string | null) => void
}

/** A label card: control name, the bound action with its category dot, and the
 *  binding's detail line. */
export function Callout({
    control,
    side,
    y,
    summary,
    selected,
    hovered,
    mono,
    onSelect,
    onHover,
}: CalloutProps): JSX.Element {
    const left = side === 'L'
    return (
        <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => onSelect(control.id)}
            onPointerEnter={() => onHover(control.id)}
            onPointerLeave={() => onHover(null)}
            className={cn(
                'absolute flex h-[50px] w-[182px] cursor-pointer flex-col justify-center gap-px rounded-[10px] border px-[11px] text-foreground transition-[top,background-color] duration-150',
                left ? 'items-end text-right' : 'items-start text-left',
                selected
                    ? 'border-primary/60 bg-[color-mix(in_oklch,var(--primary)_16%,var(--card))]'
                    : hovered
                      ? 'border-border bg-card'
                      : 'border-transparent bg-card/55',
            )}
            style={{ top: y, [left ? 'left' : 'right']: CALL_M }}
        >
            <span className="text-[9.5px] font-bold tracking-[.08em] text-muted-foreground uppercase">
                {control.name}
            </span>
            <span
                className={cn(
                    'flex max-w-full items-center gap-1.5',
                    left && 'flex-row-reverse',
                )}
            >
                <span
                    className="size-[7px] shrink-0 rounded-[3px]"
                    style={{
                        background: mono
                            ? 'var(--muted-foreground)'
                            : categoryAccent(summary.cat),
                    }}
                />
                <span className="truncate text-[13px] font-bold">
                    {summary.text}
                </span>
            </span>
            {summary.sub ? (
                <span className="max-w-full truncate font-mono text-[10.5px] text-muted-foreground">
                    {summary.sub}
                </span>
            ) : null}
        </button>
    )
}
