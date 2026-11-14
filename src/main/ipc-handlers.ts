/**
 * Main process IPC handler registration.
 * Registers all ipcMain.handle() handlers for request/response channels.
 * Each handler validates its input before processing.
 *
 * The actual device communication logic will be implemented in separate modules.
 * This file provides the handler registration pattern and placeholder implementations.
 */

import { type BrowserWindow, ipcMain } from 'electron'
import { IpcChannels, IpcEvents } from '../shared/ipc-types'
import { createLogger } from '../shared/logger'
import { validateAvailableDevice, validateUint8Array } from './ipc-validation'
import {
    connectSerial,
    disconnectSerial,
    hasActiveSerialConnection,
    listSerialDevices,
    writeSerial,
} from './serial'
import {
    connectGattDevice,
    disconnectGattDevice,
    hasActiveBluezConnection,
    listGattDevices,
    writeGatt,
} from './bluez'
import {
    connectHidDevice,
    disconnectHidDevice,
    hasActiveHidConnection,
    type HidDiscoveryFilter,
    listHidDevices,
    listHidMice,
    writeHid,
} from './hid'
import { registerSecretHandlers } from './secret-store'
import { registerGithubArtifactHandler } from './github-artifact'
import { createTransportRouter, type TransportRouter } from './transport-router'

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

// pattern-check: skip — local IPC payload validator, no abstraction.
// A connection id from the renderer: a positive integer, else none (an older
// caller that names no connection).
function parseConnectionId(arg: unknown): number | undefined {
    return typeof arg === 'number' && Number.isInteger(arg) && arg > 0
        ? arg
        : undefined
}

const errorMessage = (e: unknown): string =>
    e instanceof Error ? e.message : String(e)

// The one device connection the main process holds, across every transport.
// Opening any kind closes the others; sends, closes and events carry the
// connection id so a stale one can't touch its successor (L4.1, L4.3).
function createRouter(): TransportRouter {
    return createTransportRouter(
        {
            serial: {
                write: writeSerial,
                close: disconnectSerial,
                isOpen: hasActiveSerialConnection,
            },
            bluez: {
                write: writeGatt,
                close: disconnectGattDevice,
                isOpen: hasActiveBluezConnection,
            },
            hid: {
                write: writeHid,
                close: disconnectHidDevice,
                isOpen: hasActiveHidConnection,
            },
        },
        {
            data: (data, id) => ipcHandlerContext.emitConnectionData(data, id),
            disconnected: (id) =>
                ipcHandlerContext.emitConnectionDisconnected(id),
        },
    )
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
    // --- GitHub artifact download proxy (dodges renderer CORS) ---
    registerGithubArtifactHandler()

    const router = createRouter()

    // --- Serial Device Handlers ---

    ipcMain.handle(IpcChannels.SERIAL_LIST_DEVICES, async () => {
        return await listSerialDevices()
    })

    ipcMain.handle(IpcChannels.SERIAL_CONNECT, async (_, device: unknown) => {
        const validDevice = validateAvailableDevice(device)
        try {
            const { connectionId } = await router.open('serial', (callbacks) =>
                connectSerial(validDevice.id, callbacks),
            )
            return { ok: true, connectionId }
        } catch (e) {
            log.error('SERIAL_CONNECT failed:', errorMessage(e))
            return { ok: false, error: errorMessage(e) }
        }
    })

    ipcMain.handle(IpcChannels.SERIAL_DISCONNECT, async () => {
        if (router.activeKind() === 'serial') await router.close()
        else await disconnectSerial()
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
            const { connectionId, result: label } = await router.open(
                'bluez',
                (callbacks) =>
                    connectGattDevice(
                        devicePath,
                        d.serviceUuid,
                        d.charUuid,
                        callbacks,
                    ),
            )
            return { ok: true, label, connectionId }
        } catch (e) {
            log.error('BLUEZ_CONNECT failed:', errorMessage(e))
            return { ok: false, error: errorMessage(e) }
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
            const { connectionId, result: label } = await router.open(
                'hid',
                (callbacks) => connectHidDevice(path, callbacks),
            )
            return { ok: true, label, connectionId }
        } catch (e) {
            log.error('HID_CONNECT failed:', errorMessage(e))
            return { ok: false, error: errorMessage(e) }
        }
    })

    // --- Transport Handlers (route via the active connection) ---

    ipcMain.handle(
        IpcChannels.TRANSPORT_SEND_DATA,
        async (_, data: unknown, connectionId: unknown) => {
            const validData = validateUint8Array(data)
            await router.send(validData, parseConnectionId(connectionId))
        },
    )

    ipcMain.handle(
        IpcChannels.TRANSPORT_CLOSE,
        async (_, connectionId: unknown) => {
            await router.close(parseConnectionId(connectionId))
        },
    )

    // Expose event helpers for use by transport implementations
    return void setupEventEmitters(getWindows)
}

/**
 * Set up event emitter helpers that transport implementations can use
 * to push data/events to the renderer process.
 */
function setupEventEmitters(getWindows: () => BrowserWindow[]): void {
    ipcHandlerContext.emitConnectionData = (
        data: number[],
        connectionId: number,
    ): void => {
        sendToAllWindows(
            getWindows(),
            IpcEvents.CONNECTION_DATA,
            data,
            connectionId,
        )
    }

    ipcHandlerContext.emitConnectionDisconnected = (
        connectionId: number,
    ): void => {
        sendToAllWindows(
            getWindows(),
            IpcEvents.CONNECTION_DISCONNECTED,
            connectionId,
        )
    }
}

/**
 * Context object holding event emitter functions for use by transport modules.
 * Transport implementations import this to push events to the renderer.
 */
export const ipcHandlerContext = {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    emitConnectionData: (_data: number[], _connectionId: number): void => {},
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    emitConnectionDisconnected: (_connectionId: number): void => {},
}

/**
 * Remove all registered IPC handlers. Useful for cleanup/testing.
 */
export function removeIpcHandlers(): void {
    for (const channel of Object.values(IpcChannels)) {
        ipcMain.removeHandler(channel)
    }
}
