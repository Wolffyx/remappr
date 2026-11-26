// pattern-check: skip — memoized presentational range-input row, props in / value out, no abstraction
import { memo } from 'react'

export const RgbSlider = memo(function RgbSlider({
    label,
    value,
    onChange,
    suffix = '%',
    min = 0,
    max = 100,
}: {
    label: string
    value: number
    onChange: (v: number) => void
    suffix?: string
    min?: number
    max?: number
}): JSX.Element {
    return (
        <label className="flex flex-col gap-1.5">
            <span className="flex items-center justify-between text-panel-title font-semibold">
                {label}
                <span className="font-mono text-xs text-muted-foreground">
                    {value}
                    {suffix}
                </span>
            </span>
            <input
                type="range"
                min={min}
                max={max}
                value={value}
                onChange={(e) => onChange(Number(e.currentTarget.value))}
                className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-secondary accent-primary"
            />
        </label>
    )
})
