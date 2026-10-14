// Pattern check: no GoF pattern (-) — rejected — presentational number input with −/+ steppers; commits on blur / Enter so typing is one edit.
import { useState, type JSX } from 'react'

const round2 = (v: number): number => Math.round(v * 100) / 100

export function NumField({
    label,
    value,
    step = 0.25,
    unit,
    onChange,
}: {
    label: string
    value: number
    step?: number
    unit?: string
    onChange: (v: number) => void
}): JSX.Element {
    // The text being typed; null = show the value.
    const [text, setText] = useState<string | null>(null)
    const apply = (raw: string): void => {
        setText(null)
        const n = parseFloat(raw)
        if (!Number.isNaN(n) && round2(n) !== value) onChange(round2(n))
    }
    const stepBtn =
        'h-full w-7 shrink-0 text-[15px] text-muted-foreground hover:text-foreground'
    return (
        <label className="flex min-w-0 flex-col gap-[5px]">
            <span className="text-[11.5px] font-semibold text-muted-foreground">
                {label}
            </span>
            <span className="flex h-[34px] items-center overflow-hidden rounded-lg border border-input bg-background">
                <button
                    type="button"
                    aria-label={`Decrease ${label}`}
                    className={stepBtn}
                    onClick={() => onChange(round2(value - step))}
                >
                    −
                </button>
                <input
                    value={text ?? String(value)}
                    onChange={(e) => setText(e.target.value)}
                    onBlur={(e) => apply(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') apply(e.currentTarget.value)
                    }}
                    className="w-full min-w-0 flex-1 bg-transparent text-center font-mono text-[13px] font-semibold outline-none"
                />
                {unit ? (
                    <span className="pr-0.5 text-[10.5px] text-muted-foreground">
                        {unit}
                    </span>
                ) : null}
                <button
                    type="button"
                    aria-label={`Increase ${label}`}
                    className={stepBtn}
                    onClick={() => onChange(round2(value + step))}
                >
                    +
                </button>
            </span>
        </label>
    )
}
