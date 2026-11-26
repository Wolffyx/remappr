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
vi.mock('./machine-id', () => ({ registerMachineIdHandler: () => undefined }))
vi.mock('./host-stats', () => ({ readAskedStats: async () => ({}) }))
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
    writeGatt: async (d: Uint8Array) => {
        if (!h.bluez.open) throw new Error('[bluez] no active connection')
        h.bluez.writes.push(d)
    },
}))

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

// SERIAL_CONNECT answers with the bare link id; HID and BlueZ with
// { ok, label, linkId }.
const idOf = (r: unknown): number =>
    typeof r === 'number' ? r : (r as { linkId: number }).linkId

beforeEach(async () => {
    h.ipc.clear()
    h.sent.length = 0
    h.closes.length = 0
    for (const l of [h.serial, h.hid, h.bluez]) {
        l.open = false
        l.onData = null
        l.onDisconnected = null
        l.writes.length = 0
    }
    // A fresh module per test: its link table and queue are module state.
    vi.resetModules()
    const { registerIpcHandlers } = await import('./ipc-handlers')
    registerIpcHandlers(() => [win as never])
})

describe('each kind keeps its own link (L4.3)', () => {
    it('answers a BlueZ connect with its link id', async () => {
        const b = await connectBluez()
        expect(b).toEqual({
            ok: true,
            label: 'BLE Device',
            linkId: expect.any(Number),
        })
        expect(h.bluez.open).toBe(true)
    })

    it('leaves a link of another kind open: the renderer closes it by id', async () => {
        const s = await connectSerial()
        const d = await connectHid()
        expect(h.serial.open).toBe(true)
        expect(h.hid.open).toBe(true)

        await invoke(IpcChannels.TRANSPORT_CLOSE, idOf(s))
        expect(h.closes).toEqual(['serial'])
        expect(h.hid.open).toBe(true)

        await invoke(IpcChannels.TRANSPORT_CLOSE, idOf(d))
        expect(h.closes).toEqual(['serial', 'hid'])
    })

    it('reports a closed link, not serial, when the device is gone', async () => {
        const d = await connectHid()
        h.hid.onDisconnected?.()
        h.hid.open = false
        await expect(
            invoke(
                IpcChannels.TRANSPORT_SEND_DATA,
                idOf(d),
                new Uint8Array([1]),
            ),
        ).rejects.toThrow(/link is closed/)
    })
})

describe('links carry an id end to end (L4.1)', () => {
    it('returns a fresh link id from every connect', async () => {
        const a = await connectHid('/dev/hidraw3')
        const b = await connectHid('/dev/hidraw4')
        expect(idOf(a)).toEqual(expect.any(Number))
        expect(idOf(b)).not.toBe(idOf(a))
        const s = await connectSerial()
        expect(s).toEqual(expect.any(Number))
        expect([idOf(a), idOf(b)]).not.toContain(idOf(s))
    })

    it("ignores the old device's late close once a new one is open", async () => {
        const a = await connectHid('/dev/hidraw3')
        const b = await connectHid('/dev/hidraw4')
        await invoke(IpcChannels.TRANSPORT_CLOSE, idOf(a))
        expect(h.hid.open).toBe(true)
        await invoke(
            IpcChannels.TRANSPORT_SEND_DATA,
            idOf(b),
            new Uint8Array([7]),
        )
        expect(h.hid.writes).toHaveLength(1)
    })

    it('refuses a send for a link that was replaced', async () => {
        const a = await connectHid('/dev/hidraw3')
        await connectHid('/dev/hidraw4')
        await expect(
            invoke(
                IpcChannels.TRANSPORT_SEND_DATA,
                idOf(a),
                new Uint8Array([7]),
            ),
        ).rejects.toThrow(/closed/)
        expect(h.hid.writes).toHaveLength(0)
    })

    it('tags data and disconnect events with the link id', async () => {
        const a = await connectHid()
        h.hid.onData?.([1, 2, 3])
        h.hid.onDisconnected?.()
        expect(h.sent).toEqual([
            [IpcEvents.CONNECTION_DATA, { linkId: idOf(a), data: [1, 2, 3] }],
            [IpcEvents.CONNECTION_DISCONNECTED, { linkId: idOf(a) }],
        ])
    })

    it('reports a replaced link closed once, and never again', async () => {
        const a = await connectHid('/dev/hidraw3')
        const staleDisc = h.hid.onDisconnected
        await connectHid('/dev/hidraw4')
        // The module fires the old handle's close after the new one opened.
        staleDisc?.()
        expect(h.sent).toEqual([
            [IpcEvents.CONNECTION_DISCONNECTED, { linkId: idOf(a) }],
        ])
    })

    it('runs a close queued before a connect first, whatever their timing', async () => {
        const a = await connectHid('/dev/hidraw3')
        const closing = invoke(IpcChannels.TRANSPORT_CLOSE, idOf(a))
        const opening = connectHid('/dev/hidraw4')
        await Promise.all([closing, opening])
        expect(h.hid.open).toBe(true)
    })
})
