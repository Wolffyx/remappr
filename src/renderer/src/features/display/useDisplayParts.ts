// pattern-check: skip — async read of the device's displays into state
//
// The connected device's displays (its display parts with their panel size),
// read once per ScreensApi; null while reading, [] for none or a failed read.
import { useEffect, useState } from 'react'
import type { ScreenPanel, ScreensApi } from '@firmware/service'

export function useDisplayParts(
    screens: ScreensApi | undefined,
): ScreenPanel[] | null {
    const [parts, setParts] = useState<ScreenPanel[] | null>(
        screens ? null : [],
    )
    useEffect(() => {
        if (!screens) return
        let live = true
        screens
            .displays()
            .then((list) => {
                if (live) setParts([...list])
            })
            .catch((e: unknown) => {
                console.warn('Displays: the device parts could not be read', e)
                if (live) setParts([])
            })
        return () => {
            live = false
        }
    }, [screens])
    return parts
}
