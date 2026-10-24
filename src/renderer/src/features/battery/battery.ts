// Pattern check: no GoF pattern (-) — rejected — pure helpers for showing a battery: icon by charge, text, and the once-per-session low warning bookkeeping.
//
// How the app shows a battery, whatever reported it: a direct device's battery
// part, a node through its dongle's roster, or a wireless keyboard's status.
import {
    BatteryCharging,
    BatteryFull,
    BatteryLow,
    BatteryMedium,
    BatteryWarning,
    type LucideIcon,
} from 'lucide-react'
import type { BatteryState } from '@firmware/service'
import { isBatteryLow } from '@firmware/devices/battery'

/** The firmware's own default low threshold (battery part `batteryLowPct`),
 *  used where the device's setting is not known (a node in the roster). */
export const DEFAULT_LOW_PCT = 15

/** A battery as the app shows it: its state and whether that counts as low
 *  for the device. */
export interface ShownBattery extends BatteryState {
    low: boolean
}

export function shownBattery(
    b: BatteryState,
    lowPct = DEFAULT_LOW_PCT,
): ShownBattery {
    return { ...b, low: isBatteryLow(b, lowPct) }
}

export type BatteryLook = 'charging' | 'low' | 'third' | 'half' | 'full'

export const BATTERY_ICON: Readonly<Record<BatteryLook, LucideIcon>> = {
    charging: BatteryCharging,
    low: BatteryWarning,
    third: BatteryLow,
    half: BatteryMedium,
    full: BatteryFull,
}

/** Which icon a battery takes. */
export function batteryLook(b: ShownBattery): BatteryLook {
    if (b.charging) return 'charging'
    if (b.low) return 'low'
    if (b.level <= 33) return 'third'
    if (b.level <= 66) return 'half'
    return 'full'
}

/** "73 %", "73 % · charging", "9 % · low". */
export function batteryText(b: ShownBattery): string {
    if (b.charging) return `${b.level} % · charging`
    if (b.low) return `${b.level} % · low`
    return `${b.level} %`
}

const warned = new Set<string>()

/**
 * True the first time a device's battery reads low this session (or again
 * after it read not low in between, e.g. charged), so the caller warns once.
 */
export function shouldWarnLow(
    key: string,
    b: ShownBattery | null | undefined,
): boolean {
    if (!b) return false
    if (!b.low) {
        warned.delete(key)
        return false
    }
    if (warned.has(key)) return false
    warned.add(key)
    return true
}

/** Test hook: forget every warning given. */
export function resetLowWarnings(): void {
    warned.clear()
}
