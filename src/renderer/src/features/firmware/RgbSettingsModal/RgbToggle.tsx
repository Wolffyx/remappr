// pattern-check: skip — memoized presentational checkbox row, props in / bool out, no abstraction
import { memo } from 'react'

export const RgbToggle = memo(function RgbToggle({
    on,
    onToggle,
    label,
}: {
    on: boolean
    onToggle: (v: boolean) => void
    label: string
}): JSX.Element {
    return (
        <label className="flex w-full cursor-pointer items-center justify-between rounded-lg border border-border bg-background px-2.5 py-2">
            <span className="text-panel-title font-medium">{label}</span>
            <input
                type="checkbox"
                checked={on}
                onChange={(e) => onToggle(e.currentTarget.checked)}
                className="size-4 accent-primary"
            />
        </label>
    )
})
