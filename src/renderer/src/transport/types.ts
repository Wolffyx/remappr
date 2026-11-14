// pattern-check: skip — drop unused interfaces (SerialConnectionState, ActiveConnection, TransportEventEmitter), no new logic
import type { Transport } from '@firmware'

export interface AvailableDevice {
    label: string
    /** This session's handle for connecting (an OS path, a browser index). */
    id: string
    /** Stable identity across replugs, when the transport can read one the
     *  device reports (its USB serial number). Per-device state is stored
     *  under it; see deviceKey. */
    key?: string
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
}
