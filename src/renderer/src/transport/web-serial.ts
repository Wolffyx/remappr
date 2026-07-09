// pattern-check: skip — bug fix in single transport module; cache + perm helpers are utilities
import type { Transport } from '@firmware'
import type { AvailableDevice } from '@/transport/types'
import { registerTransport } from '@/transport/adapter/registry'

const BAUD_RATE = 12500

// One id per physical device identity (vid:pid). Several SerialPort objects can
// share a vid:pid — a device that exposes multiple CDC ACM interfaces, or stale
// grants Chrome accumulates across replugs — so the registry maps an id to ALL
// of them; the list shows one card and connect tries each in turn.
const portRegistry = new Map<string, SerialPort[]>()

// Backstop for a hung port.open(): a bad/busy CDC port (or flaky USB) can leave
// open() pending forever with no cancel API, stranding the connect flow on
// "Connecting". Bounded below the 15s handshake timeout in App.tsx.
const OPEN_TIMEOUT_MS = 8_000

// pattern-check: skip — pure id/grouping utilities, no abstraction
export function makeId(info: SerialPortInfo): string {
    const vid = info.usbVendorId?.toString(16) ?? 'novid'
    const pid = info.usbProductId?.toString(16) ?? 'nopid'
    return `web-serial:${vid}:${pid}`
}

// Group granted ports by vid:pid, preserving first-seen order. Exported for
// unit tests.
export function groupPortsByVidPid(
    ports: SerialPort[],
): Map<string, SerialPort[]> {
    const groups = new Map<string, SerialPort[]>()
    for (const port of ports) {
        const id = makeId(port.getInfo())
        const existing = groups.get(id)
        if (existing) existing.push(port)
        else groups.set(id, [port])
    }
    return groups
}

// Fallback labels when WebUSB cannot supply a productName.
const KNOWN_VENDOR_LABELS: Record<number, string> = {
    0x1d50: 'OpenMoko Keyboard',
    0x239a: 'Adafruit Keyboard',
    0x303a: 'ESP32 Keyboard',
    0x2e8a: 'Raspberry Pi Pico Keyboard',
    0x16c0: 'V-USB / Teensy Keyboard',
    0x1915: 'Nordic Keyboard',
    0x05ac: 'Apple Keyboard',
    0x1209: 'Generic Keyboard',
}

const NAME_CACHE_KEY = 'remappr.usb-names'
const USER_NAME_CACHE_KEY = 'remappr.usb-names.user'
// Legacy keys from pre-rebrand (zmk-studio fork) builds — migrated once below.
const LEGACY_NAME_CACHE_KEY = 'zmk-studio.usb-names'
const LEGACY_USER_NAME_CACHE_KEY = 'zmk-studio.usb-names.user'

function vidPidKey(vid: number | undefined, pid: number | undefined): string {
    return `${vid ?? 'novid'}:${pid ?? 'nopid'}`
}

function readCache(key: string): Record<string, string> {
    if (typeof localStorage === 'undefined') return {}
    try {
        const raw = localStorage.getItem(key)
        if (!raw) return {}
        const parsed = JSON.parse(raw)
        return parsed && typeof parsed === 'object' ? parsed : {}
    } catch {
        return {}
    }
}

function writeCache(key: string, data: Record<string, string>): void {
    if (typeof localStorage === 'undefined') return
    try {
        localStorage.setItem(key, JSON.stringify(data))
    } catch {
        /* quota / privacy mode — ignore */
    }
}

// One-time migration of the cached USB names from the old `zmk-studio.*` keys
// (pre-rebrand) to the `remappr.*` namespace, so a returning user keeps their
// remembered + user-set device names. Copies only when the new key is empty and
// the legacy key exists, then clears the legacy key.
function migrateLegacyCache(legacyKey: string, key: string): void {
    if (typeof localStorage === 'undefined') return
    try {
        if (localStorage.getItem(key) !== null) return
        const legacy = localStorage.getItem(legacyKey)
        if (legacy === null) return
        localStorage.setItem(key, legacy)
        localStorage.removeItem(legacyKey)
    } catch {
        /* storage unavailable — ignore */
    }
}
migrateLegacyCache(LEGACY_NAME_CACHE_KEY, NAME_CACHE_KEY)
migrateLegacyCache(LEGACY_USER_NAME_CACHE_KEY, USER_NAME_CACHE_KEY)

function persistAutoName(
    vid: number | undefined,
    pid: number | undefined,
    name: string,
): void {
    if (vid === undefined || pid === undefined || !name) return
    const cache = readCache(NAME_CACHE_KEY)
    const k = vidPidKey(vid, pid)
    if (cache[k] === name) return
    cache[k] = name
    writeCache(NAME_CACHE_KEY, cache)
}

function loadAutoName(
    vid: number | undefined,
    pid: number | undefined,
): string | undefined {
    if (vid === undefined || pid === undefined) return undefined
    return readCache(NAME_CACHE_KEY)[vidPidKey(vid, pid)]
}

function loadUserName(
    vid: number | undefined,
    pid: number | undefined,
): string | undefined {
    if (vid === undefined || pid === undefined) return undefined
    return readCache(USER_NAME_CACHE_KEY)[vidPidKey(vid, pid)]
}

function fallbackLabel(info: SerialPortInfo): string {
    const vid = info.usbVendorId
    if (vid !== undefined && KNOWN_VENDOR_LABELS[vid]) {
        return KNOWN_VENDOR_LABELS[vid]
    }
    return 'USB Keyboard'
}

interface UsbNameRecord {
    productName?: string
    manufacturerName?: string
}

// Web Serial does not expose the OS device name. WebUSB does (productName).
// Probe getDevices() (no prompt — returns devices the origin already has
// access to) and match by vid:pid to enrich the label. If the user has
// previously granted WebUSB for the device they get the real name; if not,
// we fall back to the persisted cache or the vendor-id table.
async function buildUsbNameMap(): Promise<Map<string, UsbNameRecord>> {
    const map = new Map<string, UsbNameRecord>()
    if (typeof navigator === 'undefined' || !('usb' in navigator)) return map
    try {
        const devices = await navigator.usb.getDevices()
        for (const d of devices) {
            const key = `${d.vendorId}:${d.productId}`
            map.set(key, {
                productName: d.productName ?? undefined,
                manufacturerName: d.manufacturerName ?? undefined,
            })
        }
    } catch (e) {
        console.warn('[web-serial] WebUSB getDevices failed', e)
    }
    return map
}

function nameFromUsb(
    info: SerialPortInfo,
    usbNames: Map<string, UsbNameRecord>,
): string | undefined {
    const vid = info.usbVendorId
    const pid = info.usbProductId
    if (vid === undefined || pid === undefined) return undefined
    const rec = usbNames.get(`${vid}:${pid}`)
    if (!rec) return undefined
    if (rec.productName && rec.productName.trim() !== '') return rec.productName
    if (rec.manufacturerName && rec.manufacturerName.trim() !== '')
        return rec.manufacturerName
    return undefined
}

// Resolution chain: user override → live WebUSB → persisted cache →
// vendor-id table → generic. Live WebUSB hits write through to the cache
// so the name survives across sessions even if WebUSB grant is later
// revoked.
function resolveLabel(
    info: SerialPortInfo,
    usbNames: Map<string, UsbNameRecord>,
): string {
    const userOverride = loadUserName(info.usbVendorId, info.usbProductId)
    if (userOverride) return userOverride

    const live = nameFromUsb(info, usbNames)
    if (live) {
        persistAutoName(info.usbVendorId, info.usbProductId, live)
        return live
    }

    const cached = loadAutoName(info.usbVendorId, info.usbProductId)
    if (cached) return cached

    return fallbackLabel(info)
}

export async function listGrantedPorts(): Promise<AvailableDevice[]> {
    if (!navigator.serial) return []
    const [ports, usbNames] = await Promise.all([
        navigator.serial.getPorts(),
        buildUsbNameMap(),
    ])
    portRegistry.clear()
    // Collapse ports sharing a vid:pid into one card. Without this, a device
    // that exposes several CDC ACM interfaces (or Chrome's accumulated stale
    // grants) shows up as a growing pile of identically-labelled entries.
    const out: AvailableDevice[] = []
    for (const [id, groupPorts] of groupPortsByVidPid(ports)) {
        portRegistry.set(id, groupPorts)
        const label = resolveLabel(groupPorts[0].getInfo(), usbNames)
        out.push({ id, label })
    }
    return out
}

// Race port.open() against a timeout. Web Serial cannot cancel an in-flight
// open(), so on timeout we best-effort close the (possibly half-open) port and
// reject — freeing the connect flow to try another port or surface an error
// instead of hanging on "Connecting". Exported for unit tests.
// pattern-check: skip — local timeout-race helper, no abstraction
export async function openWithTimeout(port: SerialPort): Promise<void> {
    let timer: ReturnType<typeof setTimeout> | undefined
    const timeout = new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => {
            port.close?.().catch(() => undefined)
            reject(
                new Error(
                    `Timed out opening the serial port after ${OPEN_TIMEOUT_MS}ms.`,
                ),
            )
        }, OPEN_TIMEOUT_MS)
    })
    try {
        await Promise.race([port.open({ baudRate: BAUD_RATE }), timeout])
    } finally {
        if (timer) clearTimeout(timer)
    }
}

async function openTransport(port: SerialPort): Promise<Transport> {
    if (!port.readable || !port.writable) {
        await openWithTimeout(port).catch((e: unknown) => {
            if (e instanceof DOMException && e.name === 'NetworkError') {
                throw new Error(
                    'Failed to open the serial port. Check the permissions of the device and verify it is not in use by another process.',
                    { cause: e },
                )
            }
            throw e
        })
    }

    const info = port.getInfo()
    lastOpenedPortInfo = info
    const usbNames = await buildUsbNameMap()
    const label = resolveLabel(info, usbNames)

    const abortController = new AbortController()
    const sig = abortController.signal
    const abort_cb = async (): Promise<void> => {
        sig.removeEventListener('abort', abort_cb)
        await port.writable?.close().catch(() => undefined)
        await port.readable?.cancel().catch(() => undefined)
        await port.close().catch(() => undefined)
    }
    sig.addEventListener('abort', abort_cb)

    return {
        label,
        abortController,
        readable: port.readable!,
        writable: port.writable!,
    }
}

export async function connectToGrantedPort(
    device: AvailableDevice,
): Promise<Transport> {
    const ports = portRegistry.get(device.id)
    if (!ports || ports.length === 0) {
        throw new Error(
            'Selected serial port is no longer available. Refresh the list.',
        )
    }
    // A vid:pid can map to several ports (multiple CDC ACM interfaces, or stale
    // grants) where only some are live / speak RPC. Try each until one opens;
    // dead ports reject fast, hung ones hit the open timeout.
    let lastErr: unknown
    for (const port of ports) {
        try {
            return await openTransport(port)
        } catch (e) {
            lastErr = e
        }
    }
    throw lastErr instanceof Error
        ? lastErr
        : new Error('Failed to open the selected serial port.')
}

// Set by openTransport; read by rememberConnectedDeviceName after the
// RPC handshake reports the firmware's keyboard name.
let lastOpenedPortInfo: SerialPortInfo | null = null

export async function requestAndConnect(): Promise<Transport> {
    if (!navigator.serial) throw new Error('Web Serial not supported')
    // No VID filter: ZMK boards ship with many vendor IDs (and custom builds
    // use arbitrary ones). Match upstream ZMK Studio — show all serial ports
    // and let the user pick. KNOWN_VENDOR_LABELS is only a label fallback.
    const port = await navigator.serial.requestPort({})

    // Single-prompt flow: Web Serial can't return the productName, but the
    // ZMK firmware does — once the Serial connection opens we receive the
    // keyboard name via core.getDeviceInfo (see rpcConnect.ts). Higher
    // layers call rememberConnectedDeviceName() with that result and we
    // persist it keyed by vid:pid, so future sessions resolve the name
    // silently from cache.
    const info = port.getInfo()
    const id = makeId(info)
    const existing = portRegistry.get(id)
    if (existing) {
        if (!existing.includes(port)) existing.push(port)
    } else {
        portRegistry.set(id, [port])
    }
    return openTransport(port)
}

// Called by the connection layer once core.getDeviceInfo returns the
// firmware-set keyboard name. No-op when no web-serial port has been
// opened recently (BLE / Electron paths).
export function rememberConnectedDeviceName(name: string): void {
    if (!lastOpenedPortInfo || !name) return
    persistAutoName(
        lastOpenedPortInfo.usbVendorId,
        lastOpenedPortInfo.usbProductId,
        name,
    )
}

// Subscribe to physical USB plug / unplug events for already-granted ports.
// `connect` fires when a previously-granted device is plugged back in.
// `disconnect` fires on unplug. Returns an unsubscribe function.
export function onPortsChanged(cb: () => void): () => void {
    if (typeof navigator === 'undefined' || !navigator.serial) {
        return () => undefined
    }
    const handler = (): void => cb()
    navigator.serial.addEventListener('connect', handler)
    navigator.serial.addEventListener('disconnect', handler)
    return () => {
        navigator.serial.removeEventListener('connect', handler)
        navigator.serial.removeEventListener('disconnect', handler)
    }
}

// Persist a user-chosen friendly name for the device. Looked up first in
// the resolution chain, so it always wins over the WebUSB productName and
// the vendor-id fallback.
// pattern-check: skip — adding sibling utility forgetGrantedPort, no abstraction
export function setUserDeviceName(deviceId: string, name: string): void {
    // pattern-check: skip — array-valued registry read, no new logic
    const port = portRegistry.get(deviceId)?.[0]
    if (!port) return
    const info = port.getInfo()
    const vid = info.usbVendorId
    const pid = info.usbProductId
    if (vid === undefined || pid === undefined) return

    const cache = readCache(USER_NAME_CACHE_KEY)
    const k = vidPidKey(vid, pid)
    const trimmed = name.trim()
    if (trimmed === '') {
        delete cache[k]
    } else {
        cache[k] = trimmed
    }
    writeCache(USER_NAME_CACHE_KEY, cache)
}

// Revoke browser permission for a previously granted port and clear any
// per-id user-name override so a re-pair starts fresh.
export async function forgetGrantedPort(deviceId: string): Promise<void> {
    // pattern-check: skip — array-valued registry loop, no new logic
    const ports = portRegistry.get(deviceId)
    if (!ports || ports.length === 0) return
    const info = ports[0].getInfo()
    const vid = info.usbVendorId
    const pid = info.usbProductId

    // Revoke every port sharing this identity (all CDC interfaces + stale
    // grants) so a re-pair starts clean.
    for (const port of ports) {
        const forget = (port as SerialPort & { forget?: () => Promise<void> })
            .forget
        if (typeof forget === 'function') {
            await forget.call(port).catch(() => undefined)
        }
    }
    portRegistry.delete(deviceId)

    if (vid !== undefined && pid !== undefined) {
        const cache = readCache(USER_NAME_CACHE_KEY)
        const k = vidPidKey(vid, pid)
        if (k in cache) {
            delete cache[k]
            writeCache(USER_NAME_CACHE_KEY, cache)
        }
    }
}

registerTransport({
    id: 'web:serial',
    envs: 'web',
    create() {
        if (typeof navigator === 'undefined' || !navigator.serial) return null
        return {
            label: 'USB',
            communication: 'serial',
            pick_and_connect: {
                list: listGrantedPorts,
                connect: connectToGrantedPort,
            },
            request_new: requestAndConnect,
            renameDevice: (device, name) => setUserDeviceName(device.id, name),
            forgetDevice: (device) => forgetGrantedPort(device.id),
        }
    },
    subscribeChanges(_ctx, cb) {
        return onPortsChanged(cb)
    },
})
