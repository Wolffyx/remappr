// Pattern check: no GoF pattern (-) — rejected — one effect that toasts each newly low battery in the roster; the once-per-session bookkeeping lives in battery.ts.
import { useEffect } from 'react'
import { toast } from 'sonner'
import { shouldWarnLow, type ShownBattery } from './battery'

interface WithBattery {
    key: string
    name: string
    battery?: ShownBattery
}

/** Warn once when a listed device's battery goes low (again after it was
 *  charged). The red dot and icon stay while it is low. */
export function useLowBatteryWarnings(entries: readonly WithBattery[]): void {
    useEffect(() => {
        for (const e of entries) {
            if (!shouldWarnLow(e.key, e.battery)) continue
            toast.warning(`${e.name}: battery low (${e.battery?.level}%)`, {
                description: 'Charge it soon or it will turn off.',
            })
        }
    }, [entries])
}
