// pattern-check: skip — unit test with electron and the transports faked, no production logic
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { IpcChannels, IpcEvents } from '../shared/ipc-types'

type Handler = (...args: unknown[]) => unknown

interface FakeLink {
    open: boolean
    onData: ((data: number[]) => void) | null
    onDisconnected: (() => void) | null
    writes: Uint8Array[]
}

const h = vi.hoisted(() => {
    const link = (): FakeLink => ({
        open: false,
        onData: null,
        onDisconnected: null,
        writes: [],
    })
    return {
        ipc: new Map<string, Handler>(),
        sent: [] as unknown[][],
        serial: link(),
        hid: link(),
        bluez: link(),
        closes: [] as string[],
    }
})

vi.mock('electron', () => ({
    ipcMain: {
        handle: (channel: string, fn: Handler) => h.ipc.set(channel, fn),
        removeHandler: (channel: string) => h.ipc.delete(channel),
    },
}))
vi.mock('./secret-store', () => ({ registerSecretHandlers: () => undefined }))
vi.mock('./github-artifact', () => ({
    registerGithubArtifactHandler: () => undefined,
}))

type Callbacks = {
    onData: (data: number[]) => void
    onDisconnected: () => void
}

function openLink(l: FakeLink, cb: Callbacks): void {
    l.open = true
    l.onData = cb.onData
    l.onDisconnected = cb.onDisconnected
}

function closeLink(name: string, l: FakeLink): void {
    if (!l.open) return
    l.open = false
    h.closes.push(name)
}

vi.mock('./serial', () => ({
    listSerialDevices: async () => [],
    connectSerial: async (_id: string, cb: Callbacks) => {
        if (h.serial.open) closeLink('serial', h.serial)
        openLink(h.serial, cb)
        return true
    },
    disconnectSerial: async () => closeLink('serial', h.serial),
    hasActiveSerialConnection: () => h.serial.open,
    writeSerial: async (d: Uint8Array) => {
        if (!h.serial.open) throw new Error('No active serial connection')
        h.serial.writes.push(d)
    },
}))
vi.mock('./hid', () => ({
    listHidDevices: async () => [],
    listHidMice: async () => [],
    connectHidDevice: async (path: string, cb: Callbacks) => {
        if (h.hid.open) closeLink('hid', h.hid)
        openLink(h.hid, cb)
        return path
    },
    // node-hid closes synchronously, but the close still crosses an await, so
    // a connect handled meanwhile can run first.
    disconnectHidDevice: async () => {
        await new Promise((r) => setTimeout(r, 0))
        closeLink('hid', h.hid)
    },
    hasActiveHidConnection: () => h.hid.open,
    writeHid: async (d: Uint8Array) => {
        if (!h.hid.open) throw new Error('No active HID connection')
        h.hid.writes.push(d)
    },
}))
vi.mock('./bluez', () => ({
    listGattDevices: async () => [],
    connectGattDevice: async (
        _p: string,
        _s: string,
        _c: string,
        cb: Callbacks,
    ) => {
        if (h.bluez.open) closeLink('bluez', h.bluez)
        openLink(h.bluez, cb)
        return 'BLE Device'
    },
    disconnectGattDevice: async () => closeLink('bluez', h.bluez),
    hasActiveBluezConnection: () => h.bluez.open,
    writeGatt: async (d: Uint8Array) => {
        if (!h.bluez.open) throw new Error('[bluez] no active connection')
        h.bluez.writes.push(d)
    },
}))

import { registerIpcHandlers } from './ipc-handlers'

const win = {
    isDestroyed: () => false,
    webContents: {
        send: (...args: unknown[]): void => {
            h.sent.push(args)
        },
    },
}

function invoke(channel: string, ...args: unknown[]): Promise<unknown> {
    const fn = h.ipc.get(channel)
    if (!fn) throw new Error(`no handler for ${channel}`)
    return Promise.resolve(fn({}, ...args))
}

const serialDev = { id: '/dev/ttyACM0', label: 'Serial' }
const connectSerial = (): Promise<unknown> =>
    invoke(IpcChannels.SERIAL_CONNECT, serialDev)
const connectHid = (id = '/dev/hidraw3'): Promise<unknown> =>
    invoke(IpcChannels.HID_CONNECT, { device: { id, label: 'Keyboard' } })
const connectBluez = (): Promise<unknown> =>
    invoke(IpcChannels.BLUEZ_CONNECT, {
        devicePath: '/org/bluez/hci0/dev_AA',
        serviceUuid: 'svc',
        charUuid: 'chr',
    })

const idOf = (r: unknown): number =>
    (r as { connectionId: number }).connectionId

beforeEach(() => {
    h.ipc.clear()
    h.sent.length = 0
    h.closes.length = 0
    for (const l of [h.serial, h.hid, h.bluez]) {
        l.open = false
        l.onData = null
        l.onDisconnected = null
        l.writes.length = 0
    }
    registerIpcHandlers(() => [win as never])
})

describe('connecting one transport closes every other one (L4.3)', () => {
    it('closes an open serial port when a HID device connects', async () => {
        await connectSerial()
        await connectHid()
        expect(h.serial.open).toBe(false)
        expect(h.closes).toEqual(['serial'])
    })

    it('closes an open HID device when a BlueZ link connects', async () => {
        await connectHid()
        await connectBluez()
        expect(h.hid.open).toBe(false)
        expect(h.closes).toEqual(['hid'])
    })

    it('closes an open BlueZ link when a serial port connects', async () => {
        await connectBluez()
        await connectSerial()
        expect(h.bluez.open).toBe(false)
        expect(h.closes).toEqual(['bluez'])
    })

    it('reports no device, not serial, when nothing is connected', async () => {
        await connectHid()
        h.hid.onDisconnected?.()
        h.hid.open = false
        await expect(
            invoke(IpcChannels.TRANSPORT_SEND_DATA, new Uint8Array([1])),
        ).rejects.toThrow(/No active device connection/)
    })

    it('closes every open transport on TRANSPORT_CLOSE', async () => {
        await connectHid()
        // A stray port left open by an older path must not survive a close.
        h.serial.open = true
        await invoke(IpcChannels.TRANSPORT_CLOSE)
        expect(h.hid.open).toBe(false)
        expect(h.serial.open).toBe(false)
    })
})

describe('connections carry an id end to end (L4.1)', () => {
    it('returns a fresh connection id from every connect', async () => {
        const a = await connectHid('/dev/hidraw3')
        const b = await connectHid('/dev/hidraw4')
        expect(idOf(a)).toEqual(expect.any(Number))
        expect(idOf(b)).not.toBe(idOf(a))
        const s = await connectSerial()
        expect(s).toEqual({ ok: true, connectionId: expect.any(Number) })
    })

    it("ignores the old device's late close once a new one is open", async () => {
        const a = await connectHid('/dev/hidraw3')
        const b = await connectHid('/dev/hidraw4')
        await invoke(IpcChannels.TRANSPORT_CLOSE, idOf(a))
        expect(h.hid.open).toBe(true)
        await invoke(
            IpcChannels.TRANSPORT_SEND_DATA,
            new Uint8Array([7]),
            idOf(b),
        )
        expect(h.hid.writes).toHaveLength(1)
    })

    it('refuses a send for a connection that is gone', async () => {
        const a = await connectHid('/dev/hidraw3')
        await connectHid('/dev/hidraw4')
        await expect(
            invoke(
                IpcChannels.TRANSPORT_SEND_DATA,
                new Uint8Array([7]),
                idOf(a),
            ),
        ).rejects.toThrow(/closed/)
        expect(h.hid.writes).toHaveLength(0)
    })

    it('tags data and disconnect events with the connection id', async () => {
        const a = await connectHid()
        h.hid.onData?.([1, 2, 3])
        h.hid.onDisconnected?.()
        expect(h.sent).toEqual([
            [IpcEvents.CONNECTION_DATA, [1, 2, 3], idOf(a)],
            [IpcEvents.CONNECTION_DISCONNECTED, idOf(a)],
        ])
    })

    it("drops a closed connection's late events", async () => {
        await connectSerial()
        const staleData = h.serial.onData
        const staleDisc = h.serial.onDisconnected
        await connectHid()
        // A serial port fires 'close' after its close callback resolves.
        staleData?.([9])
        staleDisc?.()
        expect(h.sent).toEqual([])
        await invoke(IpcChannels.TRANSPORT_SEND_DATA, new Uint8Array([1]))
        expect(h.hid.writes).toHaveLength(1)
    })

    it('runs a close queued before a connect first, whatever their timing', async () => {
        const a = await connectHid('/dev/hidraw3')
        const closing = invoke(IpcChannels.TRANSPORT_CLOSE, idOf(a))
        const opening = connectHid('/dev/hidraw4')
        await Promise.all([closing, opening])
        expect(h.hid.open).toBe(true)
    })
})
