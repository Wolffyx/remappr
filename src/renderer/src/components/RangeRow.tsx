// Pattern check: no GoF pattern (-) — rejected — presentational range row (label, mono value, filled track) with a local draft so a drag commits once on release.
import { memo, useState } from 'react'
import { cn } from '@/lib/cn'

interface RangeRowProps {
    label: string
    value: number
    min: number
    max: number
    step?: number
    suffix?: string
    disabled?: boolean
    /** Called once when the user lets go (pointer up, key up, blur). */
    onCommit: (v: number) => void
}

/** A labelled slider. Dragging updates a local draft; the value is committed
 *  once on release, so a drag is one edit (one undo step, one device write). */
export const RangeRow = memo(function RangeRow({
    label,
    value,
    min,
    max,
    step = 1,
    suffix = '',
    disabled = false,
    onCommit,
}: RangeRowProps): JSX.Element {
    const [draft, setDraft] = useState<number | null>(null)
    const shown = draft ?? value
    const pct = ((shown - min) / (max - min)) * 100
    const commit = (): void => {
        if (draft !== null && draft !== value) onCommit(draft)
        setDraft(null)
    }
    return (
        <div className={cn('py-2', disabled && 'opacity-50')}>
            <span className="mb-[7px] flex items-center justify-between">
                <span className="text-[13px] font-semibold">{label}</span>
                <span className="font-mono text-xs text-muted-foreground">
                    {shown}
                    {suffix}
                </span>
            </span>
            <input
                type="range"
                aria-label={label}
                min={min}
                max={max}
                step={step}
                value={shown}
                disabled={disabled}
                onChange={(e) => setDraft(Number(e.currentTarget.value))}
                onPointerUp={commit}
                onKeyUp={commit}
                onBlur={commit}
                className="h-1.5 w-full cursor-pointer appearance-none rounded-full accent-primary disabled:cursor-default"
                style={{
                    background: `linear-gradient(90deg, var(--primary) ${pct}%, var(--secondary) ${pct}%)`,
                }}
            />
        </div>
    )
})
