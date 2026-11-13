// Pattern check: no GoF pattern (-) — rejected — a small polling hook like useJoystickLive; one generic poller, no abstraction beyond it.
//
// Poll one sensor read while a view shows it. A refused read keeps the last
// value and marks the poll as failing: the sensor refuses its readings while a
// procedure holds it (a calibration's first phase), so a refusal is a state
// to show, not an error to report.
import { useEffect, useState } from 'react'

export function useSensorPoll<T>(
    read: (() => Promise<T>) | null,
    pollMs: number,
): { value: T | null; failing: boolean } {
    const [value, setValue] = useState<T | null>(null)
    const [failing, setFailing] = useState(false)
    useEffect(() => {
        if (!read) return
        let busy = false
        let live = true
        const tick = (): void => {
            if (busy) return
            busy = true
            read()
                .then((v) => {
                    if (!live) return
                    setValue(v)
                    setFailing(false)
                })
                .catch(() => {
                    if (live) setFailing(true)
                })
                .finally(() => {
                    busy = false
                })
        }
        tick()
        const id = setInterval(tick, pollMs)
        return () => {
            live = false
            clearInterval(id)
        }
    }, [read, pollMs])
    return { value, failing }
}
