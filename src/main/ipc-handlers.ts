/**
 * Main process IPC handler registration.
 * Registers all ipcMain.handle() handlers for request/response channels.
 * Each handler validates its input before processing.
 *
 * The actual device communication logic will be implemented in separate modules.
 * This file provides the handler registration pattern and placeholder implementations.
 */

import { type BrowserWindow, ipcMain } from 'electron'
import { IpcChannels, IpcEvents, type LinkId } from '../shared/ipc-types'
import { createLogger } from '../shared/logger'
import {
    validateAvailableDevice,
    validateLinkId,
    validateUint8Array,
} from './ipc-validation'
import {
    connectSerial,
    disconnectSerial,
    listSerialDevices,
    writeSerial,
} from './serial'
import {
    connectGattDevice,
    disconnectGattDevice,
    listGattDevices,
    writeGatt,
} from './bluez'
import {
    connectHidDevice,
    disconnectHidDevice,
    type HidDiscoveryFilter,
    listHidDevices,
    listHidMice,
    writeHid,
} from './hid'
import { registerSecretHandlers } from './secret-store'
import { registerMachineIdHandler } from './machine-id'
import { registerGithubArtifactHandler } from './github-artifact'

const log = createLogger('ipc')

// pattern-check: skip — local IPC payload validator, no abstraction.
interface DiscoveryPayload {
    serviceUuid?: unknown
    charUuid?: unknown
}

// pattern-check: skip — local IPC payload validator, no abstraction.
function parseDiscovery(
    arg: unknown,
): { serviceUuid: string; charUuid: string } | null {
    if (!arg || typeof arg !== 'object') return null
    const a = arg as DiscoveryPayload
    if (typeof a.serviceUuid !== 'string' || !a.serviceUuid) return null
    if (typeof a.charUuid !== 'string' || !a.charUuid) return null
    return { serviceUuid: a.serviceUuid, charUuid: a.charUuid }
}

// pattern-check: skip — local IPC payload validator, no abstraction.
function parseHidFilter(raw: unknown): HidDiscoveryFilter | null {
    if (!raw || typeof raw !== 'object') return null
    const f = raw as Record<string, unknown>
    const out: HidDiscoveryFilter = {}
    if (Array.isArray(f.vendorIds)) {
        out.vendorIds = f.vendorIds.filter(
            (v): v is number => typeof v === 'number',
        )
    }
    if (typeof f.usagePage === 'number') out.usagePage = f.usagePage
    if (typeof f.usage === 'number') out.usage = f.usage
    return out
}

// pattern-check: skip — local IPC payload validator, no abstraction.
function parseHidDiscovery(arg: unknown): HidDiscoveryFilter[] {
    if (!arg || typeof arg !== 'object') return []
    const a = arg as Record<string, unknown>
    if (!Array.isArray(a.filters)) return []
    return a.filters
        .map(parseHidFilter)
        .filter((f): f is HidDiscoveryFilter => f !== null)
}

// pattern-check: skip — link-id bookkeeping over the existing per-kind connect/close/write functions; two lookup tables, no abstraction.
type LinkKind = 'serial' | 'bluez' | 'hid'

interface LinkCallbacks {
    onData: (data: number[]) => void
    onDisconnected: () => void
}

// The open device links by id. Each kind's module keeps one link (opening a
// second serial port closes the first), and every connect gets a fresh id: a
// write or close from an adapter whose link was replaced (a device switch)
// is refused or dropped instead of reaching the link that replaced it.
const links = new Map<LinkId, LinkKind>()
let nextLinkId = 1

const CLOSE_LINK: Readonly<Record<LinkKind, () => Promise<void>>> = {
    serial: disconnectSerial,
    bluez: disconnectGattDevice,
    hid: disconnectHidDevice,
}

const WRITE_LINK: Readonly<
    Record<LinkKind, (data: Uint8Array) => Promise<void>>
> = {
    serial: writeSerial,
    bluez: writeGatt,
    hid: writeHid,
}

/** A fresh id for a link about to open, and callbacks that tag its events. */
function beginLink(): { id: LinkId; callbacks: LinkCallbacks } {
    const id = nextLinkId++
    return {
        id,
        callbacks: {
            onData: (data) => ipcHandlerContext.emitConnectionData(id, data),
            onDisconnected: () => endLink(id),
        },
    }
}

/** Record `id` as its kind's open link. A link of the same kind it replaced
 *  (the module's connect closed it) is reported closed. */
function commitLink(id: LinkId, kind: LinkKind): void {
    for (const [other, k] of links) {
        if (k === kind && other !== id) endLink(other)
    }
    links.set(id, kind)
}

/** Forget a link and tell the renderer it closed — once. */
function endLink(id: LinkId): void {
    if (!links.delete(id)) return
    ipcHandlerContext.emitConnectionDisconnected(id)
}

/** Send an event to all renderer windows */
function sendToAllWindows(
    windows: BrowserWindow[],
    channel: string,
    ...args: unknown[]
): void {
    for (const win of windows) {
        if (!win.isDestroyed()) {
            win.webContents.send(channel, ...args)
        }
    }
}

/**
 * Register all IPC handlers. Call this once during app initialization.
 * @param getWindows - Function that returns current BrowserWindow instances for event broadcasting
 */
export function registerIpcHandlers(getWindows: () => BrowserWindow[]): void {
    // pattern-check: skip — add one registration call, no logic change
    // --- Secret storage (safeStorage-backed) ---
    registerSecretHandlers()
    // --- Builder license machine hash ---
    registerMachineIdHandler()
    // --- GitHub artifact download proxy (dodges renderer CORS) ---
    registerGithubArtifactHandler()

    // --- Serial Device Handlers ---

    ipcMain.handle(IpcChannels.SERIAL_LIST_DEVICES, async () => {
        return await listSerialDevices()
    })

    ipcMain.handle(IpcChannels.SERIAL_CONNECT, async (_, device: unknown) => {
        const validDevice = validateAvailableDevice(device)
        const link = beginLink()
        await connectSerial(validDevice.id, link.callbacks)
        commitLink(link.id, 'serial')
        return link.id
    })

    // --- BLE Device Handlers ---
    // BLE scan coordination (start-scan, stop-scan, select-device) is
    // registered in ble-manager.ts via registerBleIpcHandlers().

    // --- BlueZ direct handlers (Linux) ---

    ipcMain.handle(IpcChannels.BLUEZ_LIST_DEVICES, async (_, arg: unknown) => {
        const d = parseDiscovery(arg)
        if (!d) return []
        return await listGattDevices(d.serviceUuid)
    })

    ipcMain.handle(IpcChannels.BLUEZ_CONNECT, async (_, arg: unknown) => {
        const a = arg as { devicePath?: unknown } & DiscoveryPayload
        const devicePath = a?.devicePath
        if (typeof devicePath !== 'string' || !devicePath) {
            return { ok: false, error: 'Invalid device path' }
        }
        const d = parseDiscovery(arg)
        if (!d) {
            return { ok: false, error: 'Invalid discovery payload' }
        }
        try {
            const link = beginLink()
            const label = await connectGattDevice(
                devicePath,
                d.serviceUuid,
                d.charUuid,
                link.callbacks,
            )
            commitLink(link.id, 'bluez')
            return { ok: true, label, linkId: link.id }
        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e)
            log.error('BLUEZ_CONNECT failed:', msg)
            return { ok: false, error: msg }
        }
    })

    ipcMain.handle(IpcChannels.GET_PLATFORM, async () => process.platform)

    // --- HID handlers (raw USB HID via node-hid) ---

    ipcMain.handle(IpcChannels.HID_LIST_DEVICES, async (_, arg: unknown) => {
        const filters = parseHidDiscovery(arg)
        return await listHidDevices(filters)
    })

    ipcMain.handle(IpcChannels.HID_LIST_MICE, async () => await listHidMice())

    ipcMain.handle(IpcChannels.HID_CONNECT, async (_, arg: unknown) => {
        const a = arg as { device?: { id?: unknown; label?: unknown } }
        const path =
            a?.device && typeof a.device.id === 'string' ? a.device.id : null
        if (!path) return { ok: false, error: 'Invalid HID device path' }
        try {
            const link = beginLink()
            const label = await connectHidDevice(path, link.callbacks)
            commitLink(link.id, 'hid')
            return { ok: true, label, linkId: link.id }
        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e)
            log.error('HID_CONNECT failed:', msg)
            return { ok: false, error: msg }
        }
    })

    // --- Transport Handlers (addressed by link id) ---

    ipcMain.handle(
        IpcChannels.TRANSPORT_SEND_DATA,
        async (_, linkId: unknown, data: unknown) => {
            const kind = links.get(validateLinkId(linkId))
            if (!kind) throw new Error('The device link is closed')
            await WRITE_LINK[kind](validateUint8Array(data))
        },
    )

    ipcMain.handle(IpcChannels.TRANSPORT_CLOSE, async (_, linkId: unknown) => {
        const id = validateLinkId(linkId)
        const kind = links.get(id)
        // Already replaced or closed: nothing of this link is left to close.
        if (!kind) return
        links.delete(id)
        await CLOSE_LINK[kind]()
    })

    // Expose event helpers for use by transport implementations
    return void setupEventEmitters(getWindows)
}

/**
 * Set up event emitter helpers that transport implementations can use
 * to push data/events to the renderer process.
 */
function setupEventEmitters(getWindows: () => BrowserWindow[]): void {
    ipcHandlerContext.emitConnectionData = (
        linkId: LinkId,
        data: number[],
    ): void => {
        sendToAllWindows(getWindows(), IpcEvents.CONNECTION_DATA, {
            linkId,
            data,
        })
    }

    ipcHandlerContext.emitConnectionDisconnected = (linkId: LinkId): void => {
        sendToAllWindows(getWindows(), IpcEvents.CONNECTION_DISCONNECTED, {
            linkId,
        })
    }
}

/**
 * Context object holding event emitter functions for use by transport modules.
 * Transport implementations import this to push events to the renderer.
 */
export const ipcHandlerContext = {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    emitConnectionData: (_linkId: LinkId, _data: number[]): void => {},
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    emitConnectionDisconnected: (_linkId: LinkId): void => {},
}
