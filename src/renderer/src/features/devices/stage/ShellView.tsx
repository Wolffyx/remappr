// Pattern check: no GoF pattern (-) — rejected — presentational component drawing the fitted body parts; no logic beyond px conversion.
import type { CSSProperties, JSX } from 'react'
import { DEV_S, type ShellPart } from './geometry'

const LIGHT_FILL =
    'linear-gradient(170deg, color-mix(in oklab, var(--foreground) 7%, var(--card)), var(--card) 60%)'
const DARK_FILL =
    'linear-gradient(90deg, color-mix(in oklab, var(--foreground) 4%, var(--background)), color-mix(in oklab, var(--foreground) 10%, var(--background)), color-mix(in oklab, var(--foreground) 4%, var(--background)))'

function partStyle(
    p: ShellPart,
    ox: number,
    oy: number,
    grow: number,
): CSSProperties {
    const w = p.w * DEV_S
    const h = p.h * DEV_S
    return {
        position: 'absolute',
        left: ox + p.x * DEV_S - grow,
        top: oy + p.y * DEV_S - grow,
        width: w + 2 * grow,
        height: h + 2 * grow,
        borderRadius: p.radius(w, h),
        transform: p.rot ? `rotate(${p.rot}deg)` : undefined,
        transformOrigin: p.origin ?? 'center',
        transition: 'all .18s ease',
    }
}

/** The device body: an outline pass then a fill pass, under one drop shadow so
 *  overlapping parts read as a single moulded shell. */
export function ShellView({
    parts,
    ox,
    oy,
    outline = false,
}: {
    parts: readonly ShellPart[]
    ox: number
    oy: number
    /** Layout mode: dashed guides around each part. */
    outline?: boolean
}): JSX.Element {
    return (
        <>
            <div className="pointer-events-none absolute inset-0 [filter:drop-shadow(0_26px_40px_rgba(0,0,0,.45))]">
                {parts.map((p, i) => (
                    <div
                        key={`o${i}`}
                        style={{
                            ...partStyle(p, ox, oy, 1.5),
                            background:
                                'color-mix(in oklab, var(--foreground) 16%, transparent)',
                        }}
                    />
                ))}
                {parts.map((p, i) => (
                    <div
                        key={`f${i}`}
                        style={{
                            ...partStyle(p, ox, oy, 0),
                            background:
                                p.tone === 'dark' ? DARK_FILL : LIGHT_FILL,
                        }}
                    />
                ))}
            </div>
            {outline &&
                parts.map((p, i) => (
                    <div
                        key={`d${i}`}
                        className="pointer-events-none border border-dashed border-primary/45"
                        style={partStyle(p, ox, oy, 6)}
                    />
                ))}
        </>
    )
}
