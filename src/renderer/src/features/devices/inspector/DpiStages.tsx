// Pattern check: no GoF pattern (-) — rejected — presentational DPI stage list (pick the active stage, step each one within the sensor's range).
import type { JSX } from 'react'
import { Minus, Plus } from 'lucide-react'
import type { SensorBinding, SensorSpec } from '@firmware/devices/types'
import { cn } from '@/lib/cn'
import { layerAccent } from '@/lib/keymap/keyCategory'

export function DpiStages({
    b,
    spec,
    disabled,
    onChange,
}: {
    b: SensorBinding
    spec: SensorSpec | undefined
    disabled?: boolean
    onChange: (patch: Partial<SensorBinding>) => void
}): JSX.Element {
    const step = spec?.dpiStep ?? 100
    const min = spec?.dpiMin ?? 100
    const max = spec?.dpiMax ?? 26000
    const bump = (i: number, d: number): void => {
        const stages = [...b.stages]
        stages[i] = Math.max(min, Math.min(max, (stages[i] ?? min) + d))
        onChange({ stages })
    }
    return (
        <div className="flex flex-col gap-[5px]">
            {b.stages.map((v, i) => {
                const on = i === b.active
                const hue = layerAccent(i)
                return (
                    <div
                        key={i}
                        role="button"
                        tabIndex={disabled ? -1 : 0}
                        onClick={() => !disabled && onChange({ active: i })}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !disabled)
                                onChange({ active: i })
                        }}
                        className={cn(
                            'flex cursor-pointer items-center gap-2.5 rounded-md border py-1.5 pr-2 pl-2.5',
                            on
                                ? 'border-primary/55 bg-[color-mix(in_oklab,var(--primary)_14%,var(--secondary))]'
                                : 'border-border bg-secondary',
                        )}
                    >
                        <span
                            className="size-2.5 rounded-full"
                            style={{
                                background: hue,
                                boxShadow: on ? `0 0 8px ${hue}` : 'none',
                            }}
                        />
                        <span className="w-11 text-caption font-bold text-muted-foreground">
                            Stage {i + 1}
                        </span>
                        <span className="flex-1 font-mono text-sm font-bold">
                            {v}
                        </span>
                        {[-step, step].map((d) => (
                            <button
                                key={d}
                                type="button"
                                disabled={disabled}
                                aria-label={d < 0 ? 'Lower DPI' : 'Raise DPI'}
                                onClick={(e) => {
                                    e.stopPropagation()
                                    bump(i, d)
                                }}
                                className="grid size-[26px] place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-40"
                            >
                                {d < 0 ? (
                                    <Minus className="size-3.5" />
                                ) : (
                                    <Plus className="size-3.5" />
                                )}
                            </button>
                        ))}
                    </div>
                )
            })}
        </div>
    )
}
