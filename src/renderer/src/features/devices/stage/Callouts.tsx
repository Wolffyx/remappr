// Pattern check: no GoF pattern (-) — rejected — presentational callout layer (leader lines, label cards); layout and routing live in callouts.ts and router.ts.
import type { JSX } from 'react'
import type { DeviceControl } from '@firmware/devices/types'
import type { BindingSummary } from '@/lib/devices/bindingSummary'
import { categoryAccent } from '@/lib/devices/deviceCategory'
import { cn } from '@/lib/cn'
import type { CalloutRoute } from './callouts'
import { CALL_M } from './geometry'

interface CalloutLinesProps {
    routes: Readonly<Record<string, CalloutRoute>>
    width: number
    height: number
    active: (id: string) => boolean
}

/** Leader lines, routed around every control by callouts.ts: each leaves its
 *  control from a port on its outline and stops just short of it, so no line
 *  runs under or over a control and no anchor dot covers a glyph. The active
 *  line is drawn last, on top. */
export function CalloutLines({
    routes,
    width,
    height,
    active,
}: CalloutLinesProps): JSX.Element {
    const list = Object.values(routes).sort(
        (a, b) => Number(active(a.id)) - Number(active(b.id)),
    )
    return (
        <svg
            width={width}
            height={height}
            className="pointer-events-none absolute inset-0"
        >
            {list.map((r) => {
                const on = active(r.id)
                return (
                    <path
                        key={r.id}
                        d={r.d}
                        fill="none"
                        stroke={
                            on
                                ? 'var(--primary)'
                                : 'color-mix(in oklab, var(--foreground) 22%, transparent)'
                        }
                        strokeWidth={on ? 1.6 : 1}
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
                    ? 'border-primary/60 bg-[color-mix(in_oklab,var(--primary)_16%,var(--card))]'
                    : hovered
                      ? 'border-border bg-card'
                      : 'border-transparent bg-card/55',
            )}
            style={{ top: y, [left ? 'left' : 'right']: CALL_M }}
        >
            <span className="eyebrow">{control.name}</span>
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
