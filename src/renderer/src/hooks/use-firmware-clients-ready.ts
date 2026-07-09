// Pattern check: no GoF pattern (-) — rejected — trivial React effect hook bridging a memoized promise to render state; no GoF structure.
import { useEffect, useState } from 'react'
import { ensureFirmwareClientsLoaded } from '@/transport/adapter/firmwareClients'

/**
 * True once the lazily-loaded firmware-client adapters have registered. Use in
 * UI that reads `getAdapters()` at render time (e.g. the firmware-family picker)
 * so it re-renders when the registry is populated. Triggers the load on mount.
 */
export function useFirmwareClientsReady(): boolean {
    const [ready, setReady] = useState(false)
    useEffect(() => {
        let active = true
        ensureFirmwareClientsLoaded().then(() => {
            if (active) setReady(true)
        })
        return () => {
            active = false
        }
    }, [])
    return ready
}
