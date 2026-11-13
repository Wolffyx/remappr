// pattern-check: skip — refactoring existing module to use callbacks, no new abstraction
import { SerialPort } from 'serialport'
import type { BrowserWindow } from 'electron'
import { exec } from 'child_process'
import { promisify } from 'util'
import * as fs from 'fs'
import * as path from 'path'
import { IpcEvents } from '../shared/ipc-types'
import { createLogger } from '../shared/logger'

const log = createLogger('serial')

const execAsync = promisify(exec)

export interface SerialDeviceInfo {
    id: string
    label: string
}

export interface SerialEventCallbacks {
    onData: (data: number[]) => void
    onDisconnected: () => void
}

interface ActiveConnection {
    port: SerialPort
    path: string
    callbacks: SerialEventCallbacks
}

let activeConnection: ActiveConnection | null = null

// Last successful enumeration's path set. connectSerial() rejects any path
// that wasn't surfaced by listSerialDevices() so a compromised renderer
// cannot pass an arbitrary OS path (e.g. /etc/shadow, \\.\pipe\foo, an
// unrelated COM device) into SerialPort.
let knownSerialPaths = new Set<string>()

const GENERIC_MANUFACTURERS = new Set(['microsoft', 'unknown', ''])

function isPnpFragment(s: string): boolean {
    return /&/.test(s)
}

// Cache of pnpId -> Windows "Bus reported device description" (the product
// descriptor set by the firmware, e.g. ZMK's CONFIG_USB_DEVICE_PRODUCT).
const winProductCache = new Map<string, string | null>()

// Read firmware-set USB product descriptor on Linux via sysfs.
// /sys/class/tty/<name>/device is symlink → USB interface dir; walk one
// level up to the USB device dir which holds the `product` file.
function getLinuxProductName(devPath: string): string | undefined {
    if (process.platform !== 'linux') return undefined
    try {
        const base = path.basename(devPath)
        const sysIface = fs.realpathSync(`/sys/class/tty/${base}/device`)
        const usbDir = path.resolve(sysIface, '..')
        const product = fs.readFileSync(path.join(usbDir, 'product'), 'utf8')
        const trimmed = product.trim()
        return trimmed || undefined
    } catch {
        return undefined
    }
}

// pattern-check: skip — parallel macOS enrichment helper, mirrors getLinuxProductName
// macOS USB product string lookup via `ioreg`. Cached for a short window
// so a single listSerialDevices() call doesn't fork ioreg per port.
const MAC_CACHE_TTL_MS = 5000
let macIoregCache: {
    ts: number
    byCallout: Map<string, string>
} | null = null

async function loadMacIoregMap(): Promise<Map<string, string>> {
    const now = Date.now()
    if (macIoregCache && now - macIoregCache.ts < MAC_CACHE_TTL_MS) {
        return macIoregCache.byCallout
    }
    const map = new Map<string, string>()
    try {
        const { stdout } = await execAsync(
            'ioreg -r -c IOUSBHostDevice -l -w 0',
            { timeout: 3000, maxBuffer: 4 * 1024 * 1024 },
        )
        // ioreg output is grouped per device, separated by blank lines.
        // Within each block we look for `"USB Product Name" = "<name>"` and
        // any `"IOCalloutDevice" = "/dev/cu.*"` entries (one per child
        // IOSerialBSDClient). Multiple callouts can map to the same
        // product name (composite USB devices expose several CDC ifaces).
        const blocks = stdout.split(/\n\s*\n/)
        for (const block of blocks) {
            const nameMatch = block.match(/"USB Product Name"\s*=\s*"([^"]+)"/)
            if (!nameMatch) continue
            const productName = nameMatch[1].trim()
            if (!productName) continue
            const calloutRegex = /"IOCalloutDevice"\s*=\s*"([^"]+)"/g
            let m: RegExpExecArray | null
            while ((m = calloutRegex.exec(block)) !== null) {
                map.set(m[1], productName)
            }
        }
    } catch (e) {
        log.warn('ioreg lookup failed:', e)
    }
    macIoregCache = { ts: now, byCallout: map }
    return map
}

async function getMacProductName(devPath: string): Promise<string | undefined> {
    if (process.platform !== 'darwin') return undefined
    const map = await loadMacIoregMap()
    return map.get(devPath)
}

// Windows PnP InstanceId charset: alnum, `\\` (path), `&`, `_`, `-`,
// `.`, `#`, `{`, `}` (rare class GUIDs). Anything else is rejected before
// it can land inside a PowerShell -Command string. Defense-in-depth on top
// of the single-quote escape — a malicious USB descriptor cannot inject
// PowerShell metacharacters such as backticks, `$(...)`, or `;`.
const PNP_ID_RE = /^[A-Za-z0-9\\&_\-.#{}]{1,256}$/

async function getWindowsProductName(
    pnpId: string | undefined,
): Promise<string | undefined> {
    if (process.platform !== 'win32' || !pnpId) return undefined
    if (!PNP_ID_RE.test(pnpId)) {
        log.warn(`pnpId rejected by allowlist: ${JSON.stringify(pnpId)}`)
        return undefined
    }
    if (winProductCache.has(pnpId)) {
        return winProductCache.get(pnpId) ?? undefined
    }
    try {
        const ps = `Get-PnpDeviceProperty -InstanceId '${pnpId.replace(/'/g, "''")}' -KeyName 'DEVPKEY_Device_BusReportedDeviceDesc' | Select-Object -ExpandProperty Data`
        const { stdout } = await execAsync(
            `powershell.exe -NoProfile -NonInteractive -Command "${ps}"`,
            { timeout: 3000, windowsHide: true },
        )
        const name = stdout.trim()
        winProductCache.set(pnpId, name || null)
        return name || undefined
    } catch {
        winProductCache.set(pnpId, null)
        return undefined
    }
}

function buildFallbackLabel(port: {
    path: string
    manufacturer?: string
    serialNumber?: string
    vendorId?: string
    productId?: string
}): string {
    const vidPid =
        port.vendorId && port.productId
            ? `${port.vendorId.toUpperCase()}:${port.productId.toUpperCase()}`
            : ''

    const mfr = (port.manufacturer || '').trim()
    const mfrOk = mfr && !GENERIC_MANUFACTURERS.has(mfr.toLowerCase())

    const sn = (port.serialNumber || '').trim()
    const snOk = sn && !isPnpFragment(sn)

    const parts = [mfrOk ? mfr : null, vidPid || null, snOk ? sn : null].filter(
        (x): x is string => !!x,
    )
    return parts.length ? `${port.path} · ${parts.join(' · ')}` : port.path
}

export async function listSerialDevices(): Promise<SerialDeviceInfo[]> {
    try {
        const allPorts = await SerialPort.list()
        // Linux: drop kernel legacy UARTs (/dev/ttyS*) and any node lacking
        // USB metadata. Real USB CDC (ZMK /dev/ttyACM*, FTDI /dev/ttyUSB*)
        // always reports vendorId. Keeps non-Linux behavior unchanged.
        const ports =
            process.platform === 'linux'
                ? allPorts.filter((p) => !!p.vendorId)
                : allPorts
        const enriched = await Promise.all(
            ports.map(async (port) => {
                const linuxProduct = getLinuxProductName(port.path)
                if (linuxProduct) {
                    return { id: port.path, label: linuxProduct }
                }
                const macProduct = await getMacProductName(port.path)
                if (macProduct) {
                    return { id: port.path, label: macProduct }
                }
                const product = await getWindowsProductName(port.pnpId)
                const label = product
                    ? `${product} (${port.path})`
                    : buildFallbackLabel(port)
                return { id: port.path, label }
            }),
        )
        knownSerialPaths = new Set(enriched.map((d) => d.id))
        return enriched
    } catch (error) {
        log.error('Failed to list serial devices:', error)
        return []
    }
}

// pattern-check: skip — change default baud param + add constant, no abstraction
// ZMK Studio's RPC serial link runs at 12500 baud (matches the web transport's
// BAUD_RATE in renderer/src/transport/web-serial.ts). Opening at any other rate
// garbles the handshake and the board reads as "not detected".
const ZMK_SERIAL_BAUD = 12500

export async function connectSerial(
    deviceId: string,
    callbacks: SerialEventCallbacks,
    baudRate: number = ZMK_SERIAL_BAUD,
): Promise<boolean> {
    await disconnectSerial()

    if (!knownSerialPaths.has(deviceId)) {
        throw new Error(
            'Unknown serial device path; call listSerialDevices first',
        )
    }

    try {
        const port = new SerialPort({
            path: deviceId,
            baudRate,
            autoOpen: false,
        })

        return new Promise((resolve, reject) => {
            port.open((err) => {
                if (err) {
                    log.error('Failed to open serial port:', err)
                    reject(err)
                    return
                }

                activeConnection = { port, path: deviceId, callbacks }

                port.on('data', (data: Buffer) => {
                    callbacks.onData(Array.from(new Uint8Array(data)))
                })

                port.on('error', (err: Error) => {
                    log.error('Serial port error:', err)
                })

                port.on('close', () => {
                    // A port closed for a newer connection must not clear it.
                    if (activeConnection?.port === port) activeConnection = null
                    callbacks.onDisconnected()
                })

                resolve(true)
            })
        })
    } catch (error) {
        log.error('Failed to connect to serial port:', error)
        throw error
    }
}

/** Settles once the last port asked to close has closed. */
let pendingClose: Promise<void> = Promise.resolve()

/** Close the open port. With none open, waits for one still closing, so a
 *  connect right after a close never opens (the same) port mid-close. */
export async function disconnectSerial(): Promise<void> {
    const closing = activeConnection
    if (!closing) return pendingClose
    // Cleared now, not in the close callback, so a late callback can't clear
    // a connection opened after it.
    activeConnection = null
    pendingClose = new Promise((resolve) => {
        closing.port.close((err) => {
            if (err) {
                log.error('Error closing serial port:', err)
            }
            resolve()
        })
    })
    return pendingClose
}

const HOTPLUG_POLL_MS = 2000

function fingerprint(devices: SerialDeviceInfo[]): string {
    return devices
        .map((d) => `${d.id}|${d.label}`)
        .sort()
        .join('\n')
}

export function startSerialDevicePolling(
    getWindows: () => BrowserWindow[],
): () => void {
    let last = ''
    let stopped = false

    const tick = async (): Promise<void> => {
        if (stopped) return
        const current = await listSerialDevices()
        const fp = fingerprint(current)
        if (fp !== last) {
            last = fp
            for (const w of getWindows()) {
                if (!w.isDestroyed()) {
                    w.webContents.send(
                        IpcEvents.SERIAL_DEVICES_CHANGED,
                        current,
                    )
                }
            }
        }
    }

    const id = setInterval(tick, HOTPLUG_POLL_MS)
    tick()

    return (): void => {
        stopped = true
        clearInterval(id)
    }
}

export async function writeSerial(data: Uint8Array): Promise<void> {
    if (!activeConnection) {
        throw new Error('No active serial connection')
    }

    return new Promise((resolve, reject) => {
        activeConnection!.port.write(Buffer.from(data), (err) => {
            if (err) {
                reject(err)
                return
            }
            activeConnection!.port.drain((drainErr) => {
                if (drainErr) {
                    reject(drainErr)
                    return
                }
                resolve()
            })
        })
    })
}
