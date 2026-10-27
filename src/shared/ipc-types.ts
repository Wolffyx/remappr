/**
 * Shared IPC type definitions for Electron main <-> renderer communication.
 * These types define the contract for all IPC channels and their payloads.
 */

// Re-export transport types used across IPC boundaries
export interface AvailableDevice {
    label: string
    id: string
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

// pattern-check: skip — flat IPC DTO, no behavior
/** A mouse the OS lists as a HID pointer (usage page 0x01, usage 0x02). Only
 *  enumerated, never opened: the app views and live-tests it. */
export interface HidMousePayload {
    name: string
    vendorId: number
    productId: number
    serialNumber?: string
}

/**
 * One open device link in main. Every connect returns a fresh id; writes and
 * closes name the link they mean, and data / disconnect events name the link
 * they came from, so an adapter whose link was replaced can neither close nor
 * hear the link that replaced it.
 */
export type LinkId = number

export interface LinkConnectResult {
    ok: boolean
    label?: string
    linkId?: LinkId
    error?: string
}

// --- IPC Channel Names ---

/** Request/response channels (renderer invokes, main handles) */
export const IpcChannels = {
    // Serial device operations
    SERIAL_LIST_DEVICES: 'serial:list-devices',
    SERIAL_CONNECT: 'serial:connect',

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
    // Mice the OS lists (enumerated only; view + live test, never opened)
    HID_LIST_MICE: 'hid:list-mice',

    // Platform info
    GET_PLATFORM: 'platform:get',

    // Transport operations (shared by serial, BlueZ and HID), addressed by the
    // link id the connect returned
    TRANSPORT_SEND_DATA: 'transport:send-data',
    TRANSPORT_CLOSE: 'transport:close',

    // Update check (manual trigger from renderer)
    UPDATES_CHECK: 'updates:check',

    // Window controls (custom titlebar)
    WINDOW_MINIMIZE: 'window:minimize',
    WINDOW_MAXIMIZE_TOGGLE: 'window:maximize-toggle',
    WINDOW_CLOSE: 'window:close',
    WINDOW_IS_MAXIMIZED: 'window:is-maximized',
    // Unsaved-changes guard: the renderer says whether a device holds unsaved
    // edits (main then holds a window close and asks it), and answers that
    // request once the user chose.
    WINDOW_SET_UNSAVED: 'window:set-unsaved',
    WINDOW_LEAVE_DECIDED: 'window:leave-decided',

    // Secret storage (OS-encrypted via safeStorage) — e.g. the GitHub token,
    // kept out of plain localStorage.
    SECRET_GET: 'secret:get',
    SECRET_SET: 'secret:set',
    SECRET_DELETE: 'secret:delete',

    // GitHub Actions artifact download — proxied through main to dodge the
    // renderer CORS wall on the signed redirect target. Token is read from the
    // secret store in main; only api.github.com URLs are honored.
    GITHUB_DOWNLOAD_ARTIFACT: 'github:download-artifact',

    // Sign-in: the auth code a remappr://auth/callback deep link carried, if
    // one is waiting (cleared on read).
    AUTH_TAKE_CALLBACK: 'auth:take-callback',

    // Builder licenses: sha256(app salt ‖ OS machine id), or null.
    LICENSE_MACHINE_HASH: 'license:machine-hash',

    // Delivered builder packages (verified, kept in userData, served over
    // remappr-pkg://): store one, list the cached ones, drop one.
    PACKAGE_STORE: 'package:store',
    PACKAGE_LIST: 'package:list',
    PACKAGE_REMOVE: 'package:remove',

    // One-time hand-over of the old file:// storage after the move to app://.
    STORAGE_MIGRATION_TAKE: 'storage:migration-take',
} as const

/** Event channels (main pushes to renderer) */
export const IpcEvents = {
    CONNECTION_DATA: 'connection:data',
    CONNECTION_DISCONNECTED: 'connection:disconnected',
    BLE_DEVICES_DISCOVERED: 'ble:devices-discovered',
    SERIAL_DEVICES_CHANGED: 'serial:devices-changed',
    UPDATE_AVAILABLE: 'update:available',
    /** A close or quit waits on the renderer's unsaved-changes prompt. */
    WINDOW_LEAVE_REQUESTED: 'window:leave-requested',
    /** A remappr://auth/callback deep link arrived: `{ code }`. */
    AUTH_CALLBACK: 'auth:callback',
    /** A remappr://auth/handoff deep link arrived: `{ state }` (browser
     *  sign-in finished; the app claims its login). */
    AUTH_HANDOFF: 'auth:handoff',
} as const

// pattern-check: skip — flat IPC DTO, no behavior
export interface UpdateAvailablePayload {
    version: string
    url: string
    notes: string
    /** ISO date-time the release was published. */
    publishedAt: string
}

// pattern-check: skip — flat IPC DTO, no behavior
export interface UpdateCheckResultPayload {
    status: 'newer' | 'current' | 'unchanged' | 'error'
    version?: string
    url?: string
    error?: string
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
