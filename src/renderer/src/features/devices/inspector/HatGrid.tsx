// Pattern check: no GoF pattern (-) — rejected — presentational 3×3 direction grid of a hat / d-pad; diagonals dim in 4-way mode.
import type { JSX } from 'react'
import type { HatBinding } from '@firmware/devices/types'
import { cn } from '@/lib/cn'
import type { CatalogIndex } from '@/lib/devices/bindingSummary'
import { categoryAccent } from '@/lib/devices/deviceCategory'

export type HatDir =
    | 'ul'
    | 'up'
    | 'ur'
    | 'left'
    | 'right'
    | 'dl'
    | 'down'
    | 'dr'

const CELLS: readonly (readonly [HatDir, string] | null)[] = [
    ['ul', '↖'],
    ['up', '↑'],
    ['ur', '↗'],
    ['left', '←'],
    null,
    ['right', '→'],
    ['dl', '↙'],
    ['down', '↓'],
    ['dr', '↘'],
]

export function HatGrid({
    b,
    ix,
    disabled,
    onSlot,
}: {
    b: HatBinding
    ix: CatalogIndex
    disabled?: boolean
    onSlot: (dir: HatDir, glyph: string) => void
}): JSX.Element {
    return (
        <div className="grid grid-cols-3 gap-1.5">
            {CELLS.map((cell, i) => {
                if (!cell) {
                    return (
                        <div
                            key={i}
                            className="grid place-items-center font-mono text-[11px] font-bold text-muted-foreground"
                        >
                            {b.ways}-way
                        </div>
                    )
                }
                const [dir, glyph] = cell
                const dim = dir.length === 2 && b.ways === 4
                const a = ix.action(b[dir])
                const off = b[dir] == null
                const accent = categoryAccent(a.cat)
                return (
                    <button
                        key={dir}
                        type="button"
                        disabled={dim || disabled}
                        onClick={() => onSlot(dir, glyph)}
                        className={cn(
                            'flex h-[58px] flex-col items-center justify-center gap-[3px] rounded-[9px] border p-1 disabled:cursor-default',
                            off && 'border-dashed border-border bg-transparent',
                            dim && 'opacity-35',
                        )}
                        style={
                            off
                                ? undefined
                                : {
                                      background: `color-mix(in oklch, ${accent} 12%, var(--secondary))`,
                                      borderColor: `color-mix(in oklch, ${accent} 40%, var(--border))`,
                                  }
                        }
                    >
                        <span className="text-[13px] text-muted-foreground">
                            {glyph}
                        </span>
                        <span
                            className={cn(
                                'max-w-full truncate text-[11px] font-bold',
                                off && 'text-muted-foreground',
                            )}
                        >
                            {off ? '—' : a.label}
                        </span>
                    </button>
                )
            })}
        </div>
    )
}
