// pattern-check: skip — drop unused interfaces (SerialConnectionState, ActiveConnection, TransportEventEmitter), no new logic
import type { Transport } from '@firmware'

export interface AvailableDevice {
    label: string
    id: string
}

/**
 * Unified transport factory interface used by StartPage. Each transport
 * provides either a direct `connect` (browser Web APIs) or a
 * `pick_and_connect` with device listing (Electron native).
 */
export type TransportFactory = {
    label: string
    communication: 'serial' | 'ble' | 'hid'
    isWireless?: boolean
    connect?: () => Promise<Transport>
    pick_and_connect?: {
        list: () => Promise<Array<AvailableDevice>>
        connect: (dev: AvailableDevice) => Promise<Transport>
    }
    /**
     * Trigger the browser/OS chooser to grant access to a new device, then
     * connect. Used by Web Serial / Web HID / Web BLE where the granted list
     * starts empty until the user picks once.
     */
    request_new?: () => Promise<Transport>
    /** Persist a user-supplied display name for a previously seen device. */
    renameDevice?: (device: AvailableDevice, name: string) => void
    /** Revoke browser permission for a paired device (browser only). */
    forgetDevice?: (device: AvailableDevice) => Promise<void>
    /**
     * Holds one open link per transport: opening a device here closes the
     * one already open on it (Electron's main process). A device switch on
     * the same transport closes the current device first.
     */
    singleLink?: boolean
}
