// pattern-check: skip — effect wiring the host feed to the connected service
//
// Runs the host feed for the connected device while it serves host values,
// and stops it when the device goes (or another one connects).
import { useEffect } from 'react'
import useConnectionStore from '@/stores/connectionStore'
import useHostTextStore from '@/stores/hostTextStore'
import { startHostFeed } from './hostFeed'

export function useHostFeed(): void {
    const hostValues = useConnectionStore((s) => s.service?.hostValues)
    useEffect(() => {
        if (!hostValues) return
        return startHostFeed(hostValues, {
            texts: () => useHostTextStore.getState().texts,
        })
    }, [hostValues])
}
