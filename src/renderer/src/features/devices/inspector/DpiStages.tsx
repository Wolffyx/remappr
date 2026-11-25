// Pattern check: no GoF pattern (-) — rejected — presentational DPI stage list (pick the active stage, step each one within the sensor's range; X and Y apart where the sensor allows).
import { useState, type JSX } from 'react'
import { Minus, Plus } from 'lucide-react'
import type { SensorBinding, SensorSpec } from '@firmware/devices/types'
import { cn } from '@/lib/cn'
import { layerAccent } from '@/lib/keymap/keyCategory'
import { SwitchRow } from '@/ui/switch-row'

type Axis = 'stages' | 'stagesY'

function Stepper({
    value,
    axis,
    disabled,
    onBump,
}: {
    value: number
    /** Shown before the value when the axes are apart. */
    axis?: 'X' | 'Y'
    disabled?: boolean
    onBump: (d: -1 | 1) => void
}): JSX.Element {
    return (
        <span className="flex flex-1 items-center gap-1">
            {axis && (
                <span className="text-caption font-bold text-muted-foreground">
                    {axis}
                </span>
            )}
            <span className="flex-1 font-mono text-sm font-bold">{value}</span>
            {([-1, 1] as const).map((d) => (
                <button
                    key={d}
                    type="button"
                    disabled={disabled}
                    aria-label={`${d < 0 ? 'Lower' : 'Raise'} ${axis ? `${axis} ` : ''}DPI`}
                    onClick={(e) => {
                        e.stopPropagation()
                        onBump(d)
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
        </span>
    )
}

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
    // The device only knows whether the axes differ; the switch can be on
    // with equal values until one is changed.
    const [chosen, setChosen] = useState(false)
    const apart = chosen || !!b.stagesY
    const ys = b.stagesY ?? b.stages
    const bump = (axis: Axis, i: number, d: -1 | 1): void => {
        const next = [...(axis === 'stagesY' ? ys : b.stages)]
        next[i] = Math.max(min, Math.min(max, (next[i] ?? min) + d * step))
        onChange({ [axis]: next })
    }
    const toggle = (on: boolean): void => {
        setChosen(on)
        onChange({ stagesY: on ? [...b.stages] : undefined })
    }
    return (
        <div className="flex flex-col gap-[5px]">
            {spec?.separateXY && (
                <SwitchRow
                    label="Separate X / Y"
                    checked={apart}
                    disabled={disabled}
                    onChange={toggle}
                />
            )}
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
                        <Stepper
                            value={v}
                            axis={apart ? 'X' : undefined}
                            disabled={disabled}
                            onBump={(d) => bump('stages', i, d)}
                        />
                        {apart && (
                            <Stepper
                                value={ys[i] ?? v}
                                axis="Y"
                                disabled={disabled}
                                onBump={(d) => bump('stagesY', i, d)}
                            />
                        )}
                    </div>
                )
            })}
        </div>
    )
}
