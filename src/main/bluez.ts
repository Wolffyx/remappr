// pattern-check: skip — new module mirrors serial.ts callback shape by convention, no class-based interface adaptation.
/**
 * BlueZ D-Bus adapter for Linux BLE.
 *
 * Web Bluetooth in Chromium can't see devices already paired+connected to
 * the OS BlueZ daemon (they stop advertising). This module talks to BlueZ
 * directly via its D-Bus interface (`org.bluez`), so paired/connected studio
 * keyboards show up without user gesture and without disconnecting them
 * from the OS first.
 *
 * Listing: enumerate org.bluez.Device1 objects via ObjectManager,
 * filter by firmware studio service UUID in their UUIDs property.
 *
 * Connection: call Device1.Connect(), walk GattService1/GattCharacteristic1
 * children to find the studio characteristic, StartNotify(), wire
 * PropertiesChanged → onData callback. Writes go through
 * GattCharacteristic1.WriteValue.
 */

// dbus-next is a Linux-only optional dependency (it drags in the unix-only
// native module `usocket`, which cannot compile on Windows). Import it as a
// type only so it is fully erased at build time, and load the runtime module
// lazily — exclusively on Linux, behind the platform guards below.
import { createRequire } from 'node:module'
import type dbus from 'dbus-next'
import type { AvailableDevice } from '../shared/ipc-types'
import { createLogger } from '../shared/logger'

const requireDbus = createRequire(import.meta.url)

const log = createLogger('bluez')

const BLUEZ_BUS = 'org.bluez'
const IFACE_OBJECT_MANAGER = 'org.freedesktop.DBus.ObjectManager'
const IFACE_PROPERTIES = 'org.freedesktop.DBus.Properties'
const IFACE_DEVICE = 'org.bluez.Device1'
const IFACE_GATT_SERVICE = 'org.bluez.GattService1'
const IFACE_GATT_CHAR = 'org.bluez.GattCharacteristic1'

export interface BluezEventCallbacks {
    onData: (data: number[]) => void
    onDisconnected: () => void
}

interface ActiveBluezConnection {
    devicePath: string
    charPath: string
    bus: dbus.MessageBus
    char: dbus.ProxyObject
    callbacks: BluezEventCallbacks
    charSignalKey: string
    deviceSignalKey: string
    charMatchRule: string
    deviceMatchRule: string
    onCharProps: (msg: { body: unknown[] }) => void
    onDeviceProps: (msg: { body: unknown[] }) => void
}

let active: ActiveBluezConnection | null = null

// Last successful enumeration's D-Bus path set. connectGattDevice() rejects
// any path not surfaced by listGattDevices() so a compromised renderer
// cannot pass arbitrary D-Bus paths into BlueZ proxy lookups.
let knownDevicePaths = new Set<string>()
let sharedBus: dbus.MessageBus | null = null

function getBus(): dbus.MessageBus {
    if (!sharedBus) {
        const dbusLib = requireDbus('dbus-next') as {
            systemBus: () => dbus.MessageBus
        }
        sharedBus = dbusLib.systemBus()
    }
    return sharedBus
}

function variantValue<T = unknown>(v: dbus.Variant | undefined): T | undefined {
    return v ? (v.value as T) : undefined
}

/**
 * Enumerate paired+known devices that advertise the firmware studio service.
 * Returns AvailableDevice list keyed by D-Bus object path.
 */
export async function listGattDevices(
    serviceUuid: string,
): Promise<AvailableDevice[]> {
    if (process.platform !== 'linux') return []

    try {
        const bus = getBus()
        const obj = await bus.getProxyObject(BLUEZ_BUS, '/')
        const om = obj.getInterface(IFACE_OBJECT_MANAGER)
        const managed = (await om.GetManagedObjects()) as Record<
            string,
            Record<string, Record<string, dbus.Variant>>
        >

        const out: AvailableDevice[] = []
        for (const [path, ifaces] of Object.entries(managed)) {
            const dev = ifaces[IFACE_DEVICE]
            if (!dev) continue

            const uuids = variantValue<string[]>(dev['UUIDs']) ?? []
            const matches = uuids.some(
                (u) => u.toLowerCase() === serviceUuid.toLowerCase(),
            )
            if (!matches) continue

            // Skip paired-but-offline devices. BlueZ caches Device1 + UUIDs
            // even when keyboard powered off, so without this filter the
            // list shows phantom entries that fail on Connect().
            const connected = variantValue<boolean>(dev['Connected']) ?? false
            if (!connected) continue

            const name =
                variantValue<string>(dev['Name']) ??
                variantValue<string>(dev['Alias']) ??
                variantValue<string>(dev['Address']) ??
                'BLE Device'

            out.push({ id: path, label: name })
        }
        knownDevicePaths = new Set(out.map((d) => d.id))
        return out
    } catch (e) {
        log.error('listGattDevices failed:', e)
        return []
    }
}

/**
 * Walk the BlueZ object tree under `devicePath` to find the firmware Studio
 * characteristic D-Bus path. Returns null if service/characteristic are
 * not yet resolved (caller can retry after Device1.Connect()).
 */
async function findCharPath(
    bus: dbus.MessageBus,
    devicePath: string,
    serviceUuid: string,
    charUuid: string,
): Promise<string | null> {
    const root = await bus.getProxyObject(BLUEZ_BUS, '/')
    const om = root.getInterface(IFACE_OBJECT_MANAGER)
    const managed = (await om.GetManagedObjects()) as Record<
        string,
        Record<string, Record<string, dbus.Variant>>
    >

    // Find studio GATT service under this device
    let gattServicePath: string | null = null
    for (const [path, ifaces] of Object.entries(managed)) {
        if (!path.startsWith(devicePath + '/')) continue
        const svc = ifaces[IFACE_GATT_SERVICE]
        if (!svc) continue
        const uuid = variantValue<string>(svc['UUID']) ?? ''
        if (uuid.toLowerCase() === serviceUuid.toLowerCase()) {
            gattServicePath = path
            break
        }
    }
    if (!gattServicePath) return null

    // Find characteristic under the service
    for (const [path, ifaces] of Object.entries(managed)) {
        if (!path.startsWith(gattServicePath + '/')) continue
        const ch = ifaces[IFACE_GATT_CHAR]
        if (!ch) continue
        const uuid = variantValue<string>(ch['UUID']) ?? ''
        if (uuid.toLowerCase() === charUuid.toLowerCase()) {
            return path
        }
    }
    return null
}

async function waitForCharResolution(
    bus: dbus.MessageBus,
    devicePath: string,
    serviceUuid: string,
    charUuid: string,
    timeoutMs: number,
): Promise<string | null> {
    const deadline = Date.now() + timeoutMs
    let delay = 100
    while (Date.now() < deadline) {
        const p = await findCharPath(bus, devicePath, serviceUuid, charUuid)
        if (p) return p
        await new Promise((r) => setTimeout(r, delay))
        delay = Math.min(delay * 2, 500)
    }
    return null
}

/**
 * Connect to a firmware device by its BlueZ D-Bus path. Establishes GATT,
 * starts notifications on the studio characteristic, wires PropertiesChanged
 * → callbacks.onData. Returns label string on success.
 */
export async function connectGattDevice(
    devicePath: string,
    serviceUuid: string,
    charUuid: string,
    callbacks: BluezEventCallbacks,
): Promise<string> {
    // Mirror listGattDevices' guard: non-Linux platforms use renderer Web
    // Bluetooth, never this BlueZ path. Fail loudly if routing ever regresses.
    if (process.platform !== 'linux') {
        throw new Error('BlueZ GATT transport is only available on Linux')
    }

    if (active) {
        await disconnectGattDevice()
    }

    if (!knownDevicePaths.has(devicePath)) {
        throw new Error('Unknown BlueZ device path; call listGattDevices first')
    }

    const bus = getBus()
    const devObj = await bus.getProxyObject(BLUEZ_BUS, devicePath)
    const device = devObj.getInterface(IFACE_DEVICE)
    const deviceProps = devObj.getInterface(IFACE_PROPERTIES)

    // Read current connection state
    const connectedV = (await deviceProps.Get(
        IFACE_DEVICE,
        'Connected',
    )) as dbus.Variant
    const alreadyConnected = (connectedV.value as boolean) === true

    log.info(
        `connectGattDevice path=${devicePath} alreadyConnected=${alreadyConnected}`,
    )
    if (!alreadyConnected) {
        await device.Connect()
        log.info('Device1.Connect() returned')
    }

    // Wait for ServicesResolved before walking GATT objects. BlueZ exposes
    // service/char children only after this flag flips.
    const servicesResolvedDeadline = Date.now() + 8000
    while (Date.now() < servicesResolvedDeadline) {
        const sr = (await deviceProps.Get(
            IFACE_DEVICE,
            'ServicesResolved',
        )) as dbus.Variant
        if (sr.value === true) break
        await new Promise((r) => setTimeout(r, 200))
    }
    log.info('ServicesResolved=true (or timed out)')

    // Find characteristic. Even if already connected, BlueZ may need a
    // moment to expose GATT child objects.
    const charPath = await waitForCharResolution(
        bus,
        devicePath,
        serviceUuid,
        charUuid,
        8000,
    )
    if (!charPath) {
        throw new Error(
            `[bluez] characteristic ${charUuid} not found under ${devicePath}`,
        )
    }
    log.info(`resolved char path=${charPath}`)

    const charObj = await bus.getProxyObject(BLUEZ_BUS, charPath)
    const char = charObj.getInterface(IFACE_GATT_CHAR)

    // Log char Flags so we know which write modes BlueZ thinks are valid.
    try {
        const cp = charObj.getInterface(IFACE_PROPERTIES)
        const flagsV = (await cp.Get(IFACE_GATT_CHAR, 'Flags')) as dbus.Variant
        log.info('char Flags:', flagsV.value)
    } catch (e) {
        log.warn('could not read char Flags:', e)
    }

    // Subscribe to PropertiesChanged via raw bus signal mechanism. dbus-next
    // ProxyInterface skips match-rule add when the signal isn't in the
    // introspection $signals array — BlueZ sometimes omits the standard
    // org.freedesktop.DBus.Properties signals from per-object introspection.
    // Workaround: add match rule manually + listen on bus._signals.
    const charMatchRule = `type='signal',sender='${BLUEZ_BUS}',interface='${IFACE_PROPERTIES}',path='${charPath}',member='PropertiesChanged'`
    const deviceMatchRule = `type='signal',sender='${BLUEZ_BUS}',interface='${IFACE_PROPERTIES}',path='${devicePath}',member='PropertiesChanged'`

    // _addMatch is internal but stable across dbus-next 0.10.x.
    const busInternal = bus as unknown as {
        _addMatch: (rule: string) => Promise<void>
        _removeMatch: (rule: string) => Promise<void>
        _signals: {
            on: (k: string, cb: (msg: unknown) => void) => void
            off: (k: string, cb: (msg: unknown) => void) => void
        }
    }
    await busInternal._addMatch(charMatchRule)
    await busInternal._addMatch(deviceMatchRule)

    const charSignalKey = JSON.stringify({
        path: charPath,
        interface: IFACE_PROPERTIES,
        member: 'PropertiesChanged',
    })
    const deviceSignalKey = JSON.stringify({
        path: devicePath,
        interface: IFACE_PROPERTIES,
        member: 'PropertiesChanged',
    })

    const onCharProps = (msg: { body: unknown[] }): void => {
        const iface = msg.body[0] as string
        if (iface !== IFACE_GATT_CHAR) return
        const changed = msg.body[1] as Record<string, dbus.Variant>
        const value = changed['Value']
        if (!value) return
        const buf = value.value as Buffer
        log.info(
            `notify ${buf.length} bytes:`,
            Array.from(buf.subarray(0, Math.min(16, buf.length))),
        )
        callbacks.onData(Array.from(new Uint8Array(buf)))
    }

    const onDeviceProps = (msg: { body: unknown[] }): void => {
        const iface = msg.body[0] as string
        if (iface !== IFACE_DEVICE) return
        const changed = msg.body[1] as Record<string, dbus.Variant>
        const c = changed['Connected']
        if (!c) return
        if ((c.value as boolean) === false) {
            callbacks.onDisconnected()
        }
    }

    busInternal._signals.on(
        charSignalKey,
        onCharProps as (msg: unknown) => void,
    )
    busInternal._signals.on(
        deviceSignalKey,
        onDeviceProps as (msg: unknown) => void,
    )
    log.info('subscribed PropertiesChanged via raw match rule')
    log.info('charSignalKey:', charSignalKey)

    // Diagnostic: log EVERY signal emitted on the bus to see if BlueZ is
    // sending PropertiesChanged at all.
    const sigEmitter = busInternal._signals as unknown as {
        emit: (k: string, msg: unknown) => boolean
    }
    const origEmit = sigEmitter.emit.bind(sigEmitter)
    sigEmitter.emit = (k: string, msg: unknown): boolean => {
        const m = msg as { path?: string; interface?: string; member?: string }
        if (m.path?.startsWith('/org/bluez/hci0/dev_')) {
            log.info(
                'diag signal',
                m.member,
                'on',
                m.interface,
                'path=',
                m.path,
            )
        }
        return origEmit(k, msg)
    }

    // List descriptors under char (look for CCCD 0x2902).
    try {
        const root = await bus.getProxyObject(BLUEZ_BUS, '/')
        const om = root.getInterface(IFACE_OBJECT_MANAGER)
        const managed = (await om.GetManagedObjects()) as Record<
            string,
            Record<string, Record<string, dbus.Variant>>
        >
        for (const [p, ifaces] of Object.entries(managed)) {
            if (!p.startsWith(charPath + '/')) continue
            const desc = ifaces['org.bluez.GattDescriptor1']
            if (!desc) continue
            log.info('descriptor at', p, 'UUID=', variantValue(desc['UUID']))
        }
    } catch (e) {
        log.warn('descriptor enumeration failed:', e)
    }

    // Force CCCD transition 0→2: stop any stale subscription first.
    // firmware firmware may register on indicate-enabled callback only when
    // value transitions, not on bonded reconnect with cached CCCD=2.
    try {
        await char.StopNotify()
        log.info('StopNotify ok')
    } catch {
        /* no prior subscription */
    }
    await char.StartNotify()
    log.info('StartNotify ok')

    // Read Notifying + CCCD value to verify BlueZ wrote 0x0002 (indicate)
    // and not 0x0001 (notify). Some BlueZ builds write the wrong value on
    // indicate-only chars.
    try {
        const cp = charObj.getInterface(IFACE_PROPERTIES)
        const nv = (await cp.Get(IFACE_GATT_CHAR, 'Notifying')) as dbus.Variant
        log.info('Notifying =', nv.value)

        // Find CCCD descriptor path + read its value.
        const root = await bus.getProxyObject(BLUEZ_BUS, '/')
        const om = root.getInterface(IFACE_OBJECT_MANAGER)
        const managed = (await om.GetManagedObjects()) as Record<
            string,
            Record<string, Record<string, dbus.Variant>>
        >
        let cccdPath: string | null = null
        for (const [p, ifaces] of Object.entries(managed)) {
            if (!p.startsWith(charPath + '/')) continue
            const desc = ifaces['org.bluez.GattDescriptor1']
            if (!desc) continue
            const u = (variantValue<string>(desc['UUID']) ?? '').toLowerCase()
            if (u.startsWith('00002902')) {
                cccdPath = p
                break
            }
        }
        if (cccdPath) {
            const cccdObj = await bus.getProxyObject(BLUEZ_BUS, cccdPath)
            const cccd = cccdObj.getInterface('org.bluez.GattDescriptor1')
            const val = (await cccd.ReadValue({})) as Buffer
            log.info('CCCD value =', Array.from(new Uint8Array(val)))
            // firmware indicate-only char needs CCCD=0x0002. If BlueZ wrote
            // 0x0001 (notify), device ignores — manually write 0x0002.
            if (val.length >= 1 && val[0] !== 0x02) {
                log.info('forcing CCCD = 0x0002 (indicate)')
                await cccd.WriteValue([0x02, 0x00], {})
                log.info('CCCD rewritten')
            }
        } else {
            log.warn('CCCD path not found')
        }
    } catch (e) {
        log.warn('CCCD inspection failed:', e)
    }

    // Diagnostic: read char to confirm GATT R/W path works at all.
    try {
        const readVal = (await char.ReadValue({})) as Buffer
        log.info(
            'ReadValue ok, bytes=',
            readVal.length,
            Array.from(readVal.subarray(0, Math.min(16, readVal.length))),
        )
    } catch (e) {
        log.warn('ReadValue failed:', e)
    }

    const devObj2 = await bus.getProxyObject(BLUEZ_BUS, devicePath)
    const deviceProps2 = devObj2.getInterface(IFACE_PROPERTIES)
    const nameV = (await deviceProps2.Get(IFACE_DEVICE, 'Name')) as dbus.Variant
    const label = (nameV?.value as string) || 'BLE Device'

    active = {
        devicePath,
        charPath,
        bus,
        char: charObj,
        callbacks,
        charSignalKey,
        deviceSignalKey,
        charMatchRule,
        deviceMatchRule,
        onCharProps,
        onDeviceProps,
    }

    return label
}

export async function writeGatt(data: Uint8Array): Promise<void> {
    if (!active) throw new Error('[bluez] no active connection')
    const char = active.char.getInterface(IFACE_GATT_CHAR)
    log.info(
        `write ${data.length} bytes:`,
        Array.from(data.subarray(0, Math.min(16, data.length))),
    )
    // Empty options → BlueZ picks based on char Flags.
    try {
        await char.WriteValue(Array.from(data), {})
        log.info('write ok')
    } catch (e) {
        log.error('WriteValue threw:', e)
        throw e
    }
}

export async function disconnectGattDevice(): Promise<void> {
    if (!active) return
    const a = active
    active = null

    const busInternal = a.bus as unknown as {
        _removeMatch: (rule: string) => Promise<void>
        _signals: { off: (k: string, cb: (msg: unknown) => void) => void }
    }
    try {
        busInternal._signals.off(
            a.charSignalKey,
            a.onCharProps as (msg: unknown) => void,
        )
        busInternal._signals.off(
            a.deviceSignalKey,
            a.onDeviceProps as (msg: unknown) => void,
        )
        await busInternal._removeMatch(a.charMatchRule).catch(() => {})
        await busInternal._removeMatch(a.deviceMatchRule).catch(() => {})
    } catch {
        /* ignore */
    }
    try {
        const char = a.char.getInterface(IFACE_GATT_CHAR)
        await char.StopNotify()
    } catch {
        /* ignore — device may already be gone */
    }
    try {
        const devObj = await a.bus.getProxyObject(BLUEZ_BUS, a.devicePath)
        const device = devObj.getInterface(IFACE_DEVICE)
        await device.Disconnect()
    } catch {
        /* ignore */
    }
}
