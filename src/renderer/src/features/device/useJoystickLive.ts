// Pattern check: no GoF pattern (-) — rejected — the panel's existing polling hook moved out and given a poll rate; no new abstraction.
//
// The joystick's live state, polled while a view shows it: slowly for the
// readout, faster while a calibration or a test needs the stick's path. Each
// reading also goes to `onSample`, for views that fold every reading in (a
// trace), not just the latest.
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import type { AxisState, JoystickApi } from '@firmware/service'

/** Failed reads in a row before the readout gives up. One is a busy moment (a
 *  calibration step writing flash); a run of them is a stick gone away. */
const MAX_FAILED_READS = 5

const message = (e: unknown): string =>
    e instanceof Error ? e.message : String(e)

export function useJoystickLive(
    api: JoystickApi,
    pollMs: number,
    onSample?: (s: AxisState) => void,
): { state: AxisState | null; lost: boolean } {
    const [state, setState] = useState<AxisState | null>(null)
    const [lost, setLost] = useState(false)
    const sampled = useRef(onSample)
    useEffect(() => {
        sampled.current = onSample
    }, [onSample])
    useEffect(() => {
        let busy = false
        let failed = 0
        const id = setInterval(() => {
            if (busy) return
            busy = true
            api.getState()
                .then((s) => {
                    failed = 0
                    setState(s)
                    sampled.current?.(s)
                })
                .catch((e: unknown) => {
                    failed += 1
                    if (failed < MAX_FAILED_READS) return
                    clearInterval(id)
                    setLost(true)
                    toast.error('Failed to read the joystick', {
                        description: message(e),
                    })
                })
                .finally(() => {
                    busy = false
                })
        }, pollMs)
        return () => clearInterval(id)
    }, [api, pollMs])
    return { state, lost }
}
