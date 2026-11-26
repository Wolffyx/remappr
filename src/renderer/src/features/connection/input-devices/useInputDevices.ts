// Pattern check: Observer (Tier 1) — extended — subscribes the input-device store to the Gamepad API's connect events and the transport hotplug events while the start page is up.
import { useEffect, useMemo } from 'react'
import { gamepadsSupported, watchGamepads } from '@firmware/generic'
import type { GenericInputDevice } from '@firmware/generic'
import { subscribeToTransportChanges } from '@/lib/transports'
import useInputDeviceStore, { withoutFirmwareTwins } from './inputDeviceStore'

export interface InputDevices {
    devices: GenericInputDevice[]
    /** The browser can see controllers (each once a button was pressed). */
    gamepadsSupported: boolean
    refresh: () => void
}

function refreshAll(): void {
    const { refreshGamepads, refreshMice } = useInputDeviceStore.getState()
    refreshGamepads()
    void refreshMice()
}

/** The generic devices to list beside the firmware ones in `firmwareLabels`,
 *  kept current while mounted. */
export function useInputDevices(
    firmwareLabels: readonly string[],
): InputDevices {
    const gamepads = useInputDeviceStore((s) => s.gamepads)
    const mice = useInputDeviceStore((s) => s.mice)

    useEffect(() => {
        refreshAll()
        const { refreshGamepads, refreshMice } = useInputDeviceStore.getState()
        const offPads = watchGamepads(refreshGamepads)
        const offUsb = subscribeToTransportChanges(() => void refreshMice())
        return () => {
            offPads()
            offUsb()
        }
    }, [])

    const devices = useMemo(
        () => withoutFirmwareTwins([...gamepads, ...mice], firmwareLabels),
        [gamepads, mice, firmwareLabels],
    )
    return {
        devices,
        gamepadsSupported: gamepadsSupported(),
        refresh: refreshAll,
    }
}
