// Pattern check: no GoF pattern (-) — rejected — thin node-hid wrapper for IPC handlers; module-level connection state mirrors src/main/serial.ts and src/main/bluez.ts shape.
// Main-process HID transport for VIA-style 32-byte report keyboards.
// Uses node-hid; loaded lazily so packaging without the native module
// (e.g. browser-only Vite preview) doesn't blow up at import time.

import { createLogger } from '../shared/logger'

const log = createLogger('hid')

export interface HidDeviceInfo {
    id: string
    label: string
}

export interface HidEventCallbacks {
    onData: (data: number[]) => void
    onDisconnected: () => void
}

export interface HidDiscoveryFilter {
    vendorIds?: number[]
    usagePage?: number
    usage?: number
}

interface NodeHidDevice {
    path?: string
    vendorId: number
    productId: number
    product?: string
    manufacturer?: string
    serialNumber?: string
    usagePage?: number
    usage?: number
    interface?: number
}

interface HidLike {
    on(event: 'data', cb: (data: Buffer) => void): void

    on(event: 'error', cb: (err: Error) => void): void

    write(data: number[]): number

    close(): void
}

interface NodeHidModule {
    devices: () => NodeHidDevice[]
    HID: new (path: string) => HidLike
}

let cachedModule: NodeHidModule | null = null

async function loadNodeHid(): Promise<NodeHidModule | null> {
    if (cachedModule) return cachedModule
    try {
        const mod = (await import('node-hid')) as unknown as
            | NodeHidModule
            | { default: NodeHidModule }
        cachedModule =
            'devices' in mod
                ? (mod as NodeHidModule)
                : (mod as { default: NodeHidModule }).default
        return cachedModule
    } catch (err) {
        log.warn('node-hid unavailable:', err)
        return null
    }
}

interface ActiveHidConnection {
    device: HidLike
    path: string
    callbacks: HidEventCallbacks
}

let activeConnection: ActiveHidConnection | null = null

// Last successful enumeration's device-path set. connectHidDevice() rejects
// any path that wasn't surfaced by listHidDevices() — a compromised renderer
// can't pass an arbitrary OS path (e.g. /dev/hidraw* a non-keyboard device,
// or platform-specific raw device handles) into node-hid.
let knownDevicePaths = new Set<string>()

function matchesFilter(d: NodeHidDevice, filter: HidDiscoveryFilter): boolean {
    if (filter.vendorIds && filter.vendorIds.length > 0) {
        if (!filter.vendorIds.includes(d.vendorId)) return false
    }
    if (
        filter.usagePage !== undefined &&
        d.usagePage !== undefined &&
        d.usagePage !== filter.usagePage
    ) {
        return false
    }
    if (
        filter.usage !== undefined &&
        d.usage !== undefined &&
        d.usage !== filter.usage
    ) {
        return false
    }
    return true
}

function buildLabel(d: NodeHidDevice): string {
    const parts: string[] = []
    if (d.product) parts.push(d.product)
    else if (d.manufacturer) parts.push(d.manufacturer)
    parts.push(
        `${d.vendorId.toString(16).padStart(4, '0').toUpperCase()}:${d.productId.toString(16).padStart(4, '0').toUpperCase()}`,
    )
    if (d.serialNumber) parts.push(d.serialNumber)
    return parts.join(' · ')
}

// pattern-check: skip — signature change (single filter → filter array) on an
// existing function; match-any enumeration, no GoF abstraction.
export async function listHidDevices(
    filters: HidDiscoveryFilter[],
): Promise<HidDeviceInfo[]> {
    const mod = await loadNodeHid()
    if (!mod) return []
    try {
        const all = mod.devices()
        // Match-any across every registered firmware family's filter (an empty
        // list means no firmware is registered, so surface nothing rather than
        // every HID device on the machine).
        const matched = all.filter((d) =>
            filters.some((f) => matchesFilter(d, f)),
        )
        const devices = matched
            .filter((d): d is NodeHidDevice & { path: string } => !!d.path)
            .map((d) => ({ id: d.path, label: buildLabel(d) }))
        knownDevicePaths = new Set(devices.map((d) => d.id))
        return devices
    } catch (err) {
        log.error('list failed:', err)
        return []
    }
}

export async function connectHidDevice(
    devicePath: string,
    callbacks: HidEventCallbacks,
): Promise<string> {
    if (activeConnection) {
        await disconnectHidDevice()
    }
    if (!knownDevicePaths.has(devicePath)) {
        throw new Error('Unknown HID device path; call listHidDevices first')
    }
    const mod = await loadNodeHid()
    if (!mod) {
        throw new Error('node-hid module unavailable')
    }
    const device = new mod.HID(devicePath)
    activeConnection = { device, path: devicePath, callbacks }

    device.on('data', (data: Buffer) => {
        callbacks.onData(Array.from(new Uint8Array(data)))
    })
    device.on('error', (err: Error) => {
        log.error('device error:', err)
        if (activeConnection?.path === devicePath) {
            activeConnection = null
            callbacks.onDisconnected()
        }
    })
    return devicePath
}

export async function writeHid(data: Uint8Array): Promise<void> {
    if (!activeConnection) {
        throw new Error('No active HID connection')
    }
    // node-hid.write() prepends a report id of 0x00 when the buffer
    // length is exactly the report size; on Windows the report id MUST
    // be the first byte. Caller is expected to pass the 32-byte VIA
    // payload — we prepend 0x00 here to satisfy the Windows convention.
    const wire = new Array<number>(data.length + 1)
    wire[0] = 0x00
    for (let i = 0; i < data.length; i++) wire[i + 1] = data[i]
    activeConnection.device.write(wire)
}

export async function disconnectHidDevice(): Promise<void> {
    if (!activeConnection) return
    try {
        activeConnection.device.close()
    } catch (err) {
        log.warn('close failed:', err)
    }
    activeConnection = null
}

export function hasActiveHidConnection(): boolean {
    return activeConnection !== null
}
