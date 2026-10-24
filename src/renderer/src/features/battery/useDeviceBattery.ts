// Pattern check: no GoF pattern (-) — rejected — one polling hook over the two neutral sources a service may offer (a battery part, the wireless status); no abstraction beyond picking the source.
//
// The open device's battery, refreshed while it is shown: from its battery
// part (charge, charging, its own low threshold) when the firmware describes
// one, else from its wireless status. Null for a device with neither.
import { useEffect, useState } from 'react'
import type { BatteryState, KeyboardService } from '@firmware/service'
import {
    batteryLowPct,
    batteryPart,
    readBattery,
} from '@firmware/devices/battery'
import { shownBattery, type ShownBattery } from './battery'

/** Battery charge moves slowly; the device itself reads it every minute. */
export const BATTERY_POLL_MS = 30_000

type Reader = () => Promise<{ state?: BatteryState; lowPct?: number }>

/** The service's battery source, or null when it has none. */
async function batteryReader(service: KeyboardService): Promise<Reader | null> {
    const sensor = service.sensor
    if (sensor) {
        const part = batteryPart(await sensor.getSensors())
        if (part) {
            const lowPct = batteryLowPct(part)
            return async () => ({
                state: await readBattery(sensor, part),
                lowPct,
            })
        }
    }
    const wireless = service.wireless
    if (wireless)
        return async () => ({ state: (await wireless.getStatus()).battery })
    return null
}

export function useDeviceBattery(
    service: KeyboardService | null,
): ShownBattery | null {
    // Keyed by the service it was read from, so a switch shows nothing stale.
    const [read, setRead] = useState<{
        from: KeyboardService
        battery: ShownBattery | null
    } | null>(null)
    useEffect(() => {
        if (!service) return
        let live = true
        let id: ReturnType<typeof setInterval> | undefined
        const show = ({ state, lowPct }: Awaited<ReturnType<Reader>>): void => {
            if (!live) return
            setRead({
                from: service,
                battery: state ? shownBattery(state, lowPct) : null,
            })
        }
        // A refused read (a busy relay, a procedure holding the parts) keeps
        // the last value; the next tick tries again.
        const keep = (e: unknown): void =>
            console.debug('battery read failed', e)
        batteryReader(service).then((read) => {
            if (!live || !read) return
            const tick = (): void => void read().then(show, keep)
            tick()
            id = setInterval(tick, BATTERY_POLL_MS)
        }, keep)
        return () => {
            live = false
            if (id) clearInterval(id)
        }
    }, [service])
    return read && read.from === service ? read.battery : null
}
