// pattern-check: skip — memoized presentational checkbox row, props in / bool out, no abstraction
import { SwitchRow } from '@/ui/switch-row'
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
    return <SwitchRow boxed label={label} checked={on} onChange={onToggle} />
})
