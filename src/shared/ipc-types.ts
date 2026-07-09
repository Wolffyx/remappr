/**
 * Shared IPC type definitions for Electron main <-> renderer communication.
 * These types define the contract for all IPC channels and their payloads.
 */

// Re-export transport types used across IPC boundaries
export interface AvailableDevice {
    label: string
    id: string
}

/**
 * BLE discovery descriptor supplied by the renderer (adapter-owned).
 * Shell layers MUST treat the UUIDs as opaque identifiers — they exist
 * to keep the shell firmware-neutral.
 */
export interface BleDiscoveryPayload {
    serviceUuid: string
    charUuid: string
}

// pattern-check: skip — flat IPC DTO, no behavior
/** One firmware family's HID match criteria. */
export interface HidDiscoveryFilter {
    vendorIds?: number[]
    usagePage?: number
    usage?: number
}

// pattern-check: skip — flat IPC DTO, no behavior
/** HID enumeration request: a device matches if it satisfies ANY filter, so all
 *  registered firmware families (Remappr, QMK/VIA, Keychron, …) surface at once. */
export interface HidDiscoveryPayload {
    filters: HidDiscoveryFilter[]
}

// --- IPC Channel Names ---

/** Request/response channels (renderer invokes, main handles) */
export const IpcChannels = {
    // Serial device operations
    SERIAL_LIST_DEVICES: 'serial:list-devices',
    SERIAL_CONNECT: 'serial:connect',
    SERIAL_DISCONNECT: 'serial:disconnect',

    // BLE device operations (Web Bluetooth flow — discovery + connect happen
    // in the renderer; main only coordinates scan lifecycle and chooser).
    BLE_START_SCAN: 'ble:start-scan',
    BLE_STOP_SCAN: 'ble:stop-scan',
    BLE_SELECT_DEVICE: 'ble:select-device',

    // BlueZ direct (Linux only) — bypasses Web Bluetooth, sees paired devices
    BLUEZ_LIST_DEVICES: 'bluez:list-devices',
    BLUEZ_CONNECT: 'bluez:connect',

    // HID device operations (raw USB HID via node-hid)
    HID_LIST_DEVICES: 'hid:list-devices',
    HID_CONNECT: 'hid:connect',

    // Platform info
    GET_PLATFORM: 'platform:get',

    // Transport operations (shared by serial & BLE)
    TRANSPORT_SEND_DATA: 'transport:send-data',
    TRANSPORT_CLOSE: 'transport:close',

    // Update check (manual trigger from renderer)
    UPDATES_CHECK: 'updates:check',

    // Window controls (custom titlebar)
    WINDOW_MINIMIZE: 'window:minimize',
    WINDOW_MAXIMIZE_TOGGLE: 'window:maximize-toggle',
    WINDOW_CLOSE: 'window:close',
    WINDOW_IS_MAXIMIZED: 'window:is-maximized',

    // Secret storage (OS-encrypted via safeStorage) — e.g. the GitHub token,
    // kept out of plain localStorage.
    SECRET_GET: 'secret:get',
    SECRET_SET: 'secret:set',
    SECRET_DELETE: 'secret:delete',

    // GitHub Actions artifact download — proxied through main to dodge the
    // renderer CORS wall on the signed redirect target. Token is read from the
    // secret store in main; only api.github.com URLs are honored.
    GITHUB_DOWNLOAD_ARTIFACT: 'github:download-artifact',
} as const

/** Event channels (main pushes to renderer) */
export const IpcEvents = {
    CONNECTION_DATA: 'connection:data',
    CONNECTION_DISCONNECTED: 'connection:disconnected',
    BLE_DEVICES_DISCOVERED: 'ble:devices-discovered',
    SERIAL_DEVICES_CHANGED: 'serial:devices-changed',
    UPDATE_AVAILABLE: 'update:available',
} as const

// pattern-check: skip — flat IPC DTO, no behavior
export interface UpdateAvailablePayload {
    version: string
    url: string
    notes: string
}

// pattern-check: skip — flat IPC DTO, no behavior
export interface UpdateCheckResultPayload {
    status: 'newer' | 'current' | 'unchanged' | 'error'
    version?: string
    url?: string
    error?: string
}

export type IpcChannel = (typeof IpcChannels)[keyof typeof IpcChannels]
export type IpcEvent = (typeof IpcEvents)[keyof typeof IpcEvents]

// --- Payload Types ---

/** Map of invoke channel -> { params, result } */
export interface IpcInvokeMap {
    [IpcChannels.SERIAL_LIST_DEVICES]: {
        params: void
        result: AvailableDevice[]
    }
    [IpcChannels.SERIAL_CONNECT]: {
        params: AvailableDevice
        result: boolean
    }
    [IpcChannels.SERIAL_DISCONNECT]: {
        params: void
        result: void
    }
    [IpcChannels.BLE_START_SCAN]: {
        params: void
        result: void
    }
    [IpcChannels.BLE_STOP_SCAN]: {
        params: void
        result: void
    }
    [IpcChannels.BLE_SELECT_DEVICE]: {
        params: string
        result: boolean
    }
    [IpcChannels.BLUEZ_LIST_DEVICES]: {
        params: BleDiscoveryPayload
        result: AvailableDevice[]
    }
    [IpcChannels.BLUEZ_CONNECT]: {
        params: { devicePath: string } & BleDiscoveryPayload
        result: { ok: boolean; label?: string; error?: string }
    }
    [IpcChannels.HID_LIST_DEVICES]: {
        params: HidDiscoveryPayload
        result: AvailableDevice[]
    }
    [IpcChannels.HID_CONNECT]: {
        params: { device: AvailableDevice }
        result: { ok: boolean; label?: string; error?: string }
    }
    [IpcChannels.GET_PLATFORM]: {
        params: void
        result: NodeJS.Platform
    }
    [IpcChannels.TRANSPORT_SEND_DATA]: {
        params: Uint8Array
        result: void
    }
    [IpcChannels.TRANSPORT_CLOSE]: {
        params: void
        result: void
    }
    [IpcChannels.UPDATES_CHECK]: {
        params: void
        result: UpdateCheckResultPayload
    }
    [IpcChannels.WINDOW_MINIMIZE]: {
        params: void
        result: void
    }
    [IpcChannels.WINDOW_MAXIMIZE_TOGGLE]: {
        params: void
        result: boolean
    }
    [IpcChannels.WINDOW_CLOSE]: {
        params: void
        result: void
    }
    [IpcChannels.WINDOW_IS_MAXIMIZED]: {
        params: void
        result: boolean
    }
    [IpcChannels.SECRET_GET]: {
        params: { key: string }
        result: string | null
    }
    [IpcChannels.SECRET_SET]: {
        params: { key: string; value: string }
        result: boolean
    }
    [IpcChannels.SECRET_DELETE]: {
        params: { key: string }
        result: boolean
    }
    [IpcChannels.GITHUB_DOWNLOAD_ARTIFACT]: {
        params: { url: string }
        result: Uint8Array | null
    }
}

/** Map of event channel -> payload type */
export interface IpcEventMap {
    [IpcEvents.CONNECTION_DATA]: number[]
    [IpcEvents.CONNECTION_DISCONNECTED]: void
    [IpcEvents.BLE_DEVICES_DISCOVERED]: AvailableDevice[]
    [IpcEvents.UPDATE_AVAILABLE]: UpdateAvailablePayload
}

// --- Preload API Surface ---

/**
 * The API exposed to the renderer via contextBridge.
 * Uses simple signatures since contextBridge serializes across the boundary.
 * Type safety at call sites is provided by the typed electron adapter modules.
 */
export interface ElectronIpcApi {
    invoke(channel: string, ...args: unknown[]): Promise<unknown>

    on(event: string, callback: (...args: unknown[]) => void): () => void
}
