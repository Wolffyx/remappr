// Pattern check: no GoF pattern (-) — rejected — one presentational icon + percent, shared by the device card, the roster and the dongle grid.
import type { JSX } from 'react'
import { cn } from '@/lib/cn'
import {
    BATTERY_ICON,
    batteryLook,
    batteryText,
    type ShownBattery,
} from './battery'

/** A battery icon by charge, with the percent unless `iconOnly`. Low reads in
 *  the destructive colour, charging in the success one. */
export function BatteryIndicator({
    battery,
    iconOnly = false,
    className,
}: {
    battery: ShownBattery
    iconOnly?: boolean
    className?: string
}): JSX.Element {
    const Icon = BATTERY_ICON[batteryLook(battery)]
    const text = batteryText(battery)
    return (
        <span
            title={`Battery ${text}`}
            aria-label={`Battery ${text}`}
            className={cn(
                'inline-flex shrink-0 items-center gap-1 font-mono text-caption tabular-nums',
                battery.low
                    ? 'text-destructive'
                    : battery.charging
                      ? 'text-success'
                      : 'text-muted-foreground',
                className,
            )}
        >
            <Icon aria-hidden className="size-3.5" />
            {!iconOnly && <span>{battery.level}%</span>}
        </span>
    )
}
