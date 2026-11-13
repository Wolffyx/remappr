// Pattern check: no GoF pattern (-) — rejected — zustand slice of the generic devices the start page lists, one refresh action per source; the sources live in @firmware/generic.
//
// Devices with no vendor protocol: controllers the Gamepad API exposes and
// (Electron only) HID mice the OS lists. They open read-only for viewing and
// live test.
import { create } from 'zustand'
import { toast } from 'sonner'
import {
    hidMouseDevice,
    listGamepads,
    type GenericInputDevice,
} from '@firmware/generic'
import { listHidMice } from '@/electron/hidMice'
import { openService } from '../openService'

interface InputDeviceState {
    gamepads: readonly GenericInputDevice[]
    mice: readonly GenericInputDevice[]
    /** Re-read the controllers the browser exposes. */
    refreshGamepads: () => void
    /** Re-list the OS's HID mice (no-op outside Electron). */
    refreshMice: () => Promise<void>
    open: (device: GenericInputDevice) => Promise<void>
}

// Only the latest mouse listing may land: a slow one must not overwrite it.
let miceRequest = 0

const useInputDeviceStore = create<InputDeviceState>()((set) => ({
    gamepads: [],
    mice: [],
    refreshGamepads: () => set({ gamepads: listGamepads() }),
    refreshMice: async () => {
        const request = ++miceRequest
        try {
            const found = await listHidMice()
            if (request !== miceRequest) return
            set({ mice: found.map(hidMouseDevice) })
        } catch (err) {
            console.warn('Listing HID mice failed', err)
        }
    },
    open: async (device) => {
        try {
            await openService(() => device.connect(), 'hid')
        } catch (err) {
            toast.error(`Could not open ${device.name}.`, {
                description: err instanceof Error ? err.message : String(err),
            })
        }
    },
}))

const USB_IDS = /\b[0-9A-F]{4}:[0-9A-F]{4}\b/gi

/** `devices` without the ones a firmware client already lists (a Remappr
 *  mouse is both a HID mouse and a firmware device): matched by the USB ids
 *  the firmware listing's labels carry. */
export function withoutFirmwareTwins(
    devices: readonly GenericInputDevice[],
    firmwareLabels: readonly string[],
): GenericInputDevice[] {
    const listed = new Set(
        firmwareLabels.flatMap((l) =>
            (l.match(USB_IDS) ?? []).map((id) => id.toUpperCase()),
        ),
    )
    return devices.filter((d) => !d.usb || !listed.has(d.usb))
}

export default useInputDeviceStore
