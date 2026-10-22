// pattern-check: skip — presentational card/field primitives for dynamic-entry tabs
import type { ReactNode } from 'react'

import { hex16, parseHex16 } from '@/lib/hex'
import { clampInt, parseIntSafe } from '@/lib/clampInt'

// Rounded entry card with a hue-tinted "#index" badge (design vocabulary).
export function EntryCard({
    index,
    accent,
    children,
}: {
    index: number
    /** CSS colour of the #index chip, e.g. layerAccent(n). */
    accent: string
    children: ReactNode
}): JSX.Element {
    return (
        <div className="flex items-center gap-4 rounded-xl border bg-background p-4">
            <span
                className="grid size-7 shrink-0 place-items-center rounded-md font-mono text-caption font-bold"
                style={{
                    background: `color-mix(in oklab, ${accent} 18%, transparent)`,
                    color: accent,
                }}
            >
                #{index}
            </span>
            <div className="flex flex-1 flex-wrap items-end gap-x-4 gap-y-3">
                {children}
            </div>
        </div>
    )
}

// Labelled control column (design "Pair").
export function Pair({
    label,
    children,
}: {
    label: string
    children: ReactNode
}): JSX.Element {
    return (
        <label className="flex flex-col gap-1">
            <span className="text-meta font-semibold uppercase tracking-wide text-muted-foreground">
                {label}
            </span>
            <div className="flex items-center gap-1.5">{children}</div>
        </label>
    )
}

// Mono chip-style hex input for a keycode value (16-bit, optional byte mask).
export function HexChip({
    value,
    onChange,
    mask,
}: {
    value: number
    onChange: (next: number) => void
    mask?: number
}): JSX.Element {
    return (
        <input
            value={hex16(value)}
            spellCheck={false}
            onChange={(e): void => {
                const v = parseHex16(e.currentTarget.value)
                onChange(mask !== undefined ? v & mask : v)
            }}
            className="w-[4.5rem] rounded-md border bg-secondary px-2 py-1.5 text-center font-mono text-xs uppercase outline-none focus:border-primary"
        />
    )
}

// Decimal chip input (e.g. tapping term in ms).
export function NumChip({
    value,
    onChange,
    min = 0,
    max = 9999,
}: {
    value: number
    onChange: (next: number) => void
    min?: number
    max?: number
}): JSX.Element {
    return (
        <input
            value={value}
            inputMode="numeric"
            onChange={(e): void =>
                onChange(
                    clampInt(parseIntSafe(e.currentTarget.value), min, max),
                )
            }
            className="w-14 rounded-md border bg-secondary px-2 py-1.5 text-center font-mono text-xs tabular-nums outline-none focus:border-primary"
        />
    )
}
