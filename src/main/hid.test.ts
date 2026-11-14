// pattern-check: skip — unit test with node-hid faked, no production logic
import { EventEmitter } from 'node:events'
import {
    afterEach,
    beforeEach,
    describe,
    expect,
    it,
    type Mock,
    vi,
} from 'vitest'
import { IpcEvents } from '../shared/ipc-types'

/* A node-hid HID handle: emits 'data' / 'error', counts close(). */
class FakeHid extends EventEmitter {
    closed = 0
    writes: number[][] = []

    constructor(readonly path: string) {
        super()
        fake.opened.push(this)
    }

    write(data: number[]): number {
        this.writes.push(data)
        return data.length
    }

    close(): void {
        this.closed++
    }
}

const fake = vi.hoisted(() => ({
    opened: [] as FakeHid[],
    devices: [] as Array<Record<string, unknown>>,
    syncCalls: 0,
    asyncCalls: 0,
    // Set to hold every devicesAsync() call open until released.
    gate: null as Promise<void> | null,
}))

vi.mock('node-hid', () => ({
    devices: () => {
        fake.syncCalls++
        return fake.devices
    },
    devicesAsync: async () => {
        fake.asyncCalls++
        if (fake.gate) await fake.gate
        return fake.devices
    },
    HID: FakeHid,
}))

import {
    connectHidDevice,
    disconnectHidDevice,
    hasActiveHidConnection,
    listHidDevices,
    startHidDevicePolling,
    writeHid,
} from './hid'

const KEYBOARD = {
    path: '/dev/hidraw3',
    vendorId: 0x1d50,
    productId: 0x0001,
    product: 'Keyboard',
    usagePage: 0xff00,
}
const DONGLE = { ...KEYBOARD, path: '/dev/hidraw4', productId: 0x0002 }

const callbacks = (): {
    onData: Mock<(data: number[]) => void>
    onDisconnected: Mock<() => void>
} => ({
    onData: vi.fn<(data: number[]) => void>(),
    onDisconnected: vi.fn<() => void>(),
})

beforeEach(async () => {
    await disconnectHidDevice()
    fake.opened.length = 0
    fake.devices = [KEYBOARD, DONGLE]
    await listHidDevices([{ usagePage: 0xff00 }])
})

describe('node-hid transport', () => {
    it('closes the device when node-hid reports an error (L4.2)', async () => {
        const cb = callbacks()
        await connectHidDevice(KEYBOARD.path, cb)
        const dev = fake.opened[0]

        dev.emit('error', new Error('could not read from HID device'))

        expect(dev.closed).toBe(1)
        expect(cb.onDisconnected).toHaveBeenCalledTimes(1)
        expect(hasActiveHidConnection()).toBe(false)
    })

    it('closes a replaced device that errors only once', async () => {
        await connectHidDevice(KEYBOARD.path, callbacks())
        const old = fake.opened[0]
        const cb = callbacks()
        await connectHidDevice(DONGLE.path, cb)
        expect(old.closed).toBe(1)

        old.emit('error', new Error('late read failure'))

        expect(old.closed).toBe(1)
        expect(cb.onDisconnected).not.toHaveBeenCalled()
        expect(hasActiveHidConnection()).toBe(true)
    })

    it('stops forwarding data after an error', async () => {
        const cb = callbacks()
        await connectHidDevice(KEYBOARD.path, cb)
        const dev = fake.opened[0]
        dev.emit('error', new Error('unplugged'))
        dev.emit('data', Buffer.from([1, 2, 3]))
        expect(cb.onData).not.toHaveBeenCalled()
    })

    it('forwards input reports as byte arrays', async () => {
        const cb = callbacks()
        await connectHidDevice(KEYBOARD.path, cb)
        fake.opened[0].emit('data', Buffer.from([0xaa, 0xbb]))
        expect(cb.onData).toHaveBeenCalledWith([0xaa, 0xbb])
    })

    it('prepends report id 0 on write', async () => {
        await connectHidDevice(KEYBOARD.path, callbacks())
        await writeHid(new Uint8Array([1, 2]))
        expect(fake.opened[0].writes).toEqual([[0, 1, 2]])
    })

    it('refuses a path the last listing did not surface', async () => {
        await expect(
            connectHidDevice('/dev/hidraw9', callbacks()),
        ).rejects.toThrow(/Unknown HID device path/)
        expect(fake.opened).toHaveLength(0)
    })

    it('closes the device on disconnect', async () => {
        await connectHidDevice(KEYBOARD.path, callbacks())
        await disconnectHidDevice()
        expect(fake.opened[0].closed).toBe(1)
        expect(hasActiveHidConnection()).toBe(false)
    })
})

describe('HID hotplug polling (L4.6)', () => {
    const sent: unknown[][] = []
    const win = {
        isDestroyed: () => false,
        webContents: { send: (...a: unknown[]) => void sent.push(a) },
    }
    let stop: () => void = () => undefined

    beforeEach(() => {
        vi.useFakeTimers()
        sent.length = 0
        fake.syncCalls = 0
        fake.asyncCalls = 0
        fake.gate = null
    })
    afterEach(() => {
        stop()
        vi.useRealTimers()
    })

    it('tells the renderer when a HID device appears or goes', async () => {
        fake.devices = [KEYBOARD]
        stop = startHidDevicePolling(() => [win as never], 2000)
        await vi.advanceTimersByTimeAsync(0)
        expect(sent).toEqual([])

        fake.devices = [KEYBOARD, DONGLE]
        await vi.advanceTimersByTimeAsync(2000)
        expect(sent).toEqual([[IpcEvents.HID_DEVICES_CHANGED]])

        await vi.advanceTimersByTimeAsync(2000)
        expect(sent).toHaveLength(1)

        fake.devices = [DONGLE]
        await vi.advanceTimersByTimeAsync(2000)
        expect(sent).toHaveLength(2)
    })

    it('stops polling when stopped', async () => {
        fake.devices = [KEYBOARD]
        stop = startHidDevicePolling(() => [win as never], 2000)
        await vi.advanceTimersByTimeAsync(0)
        stop()
        fake.devices = []
        await vi.advanceTimersByTimeAsync(4000)
        expect(sent).toEqual([])
    })

    it('enumerates without blocking the main process', async () => {
        fake.devices = [KEYBOARD]
        stop = startHidDevicePolling(() => [win as never], 2000)
        await vi.advanceTimersByTimeAsync(4000)
        expect(fake.syncCalls).toBe(0)
        expect(fake.asyncCalls).toBe(3)
    })

    it('skips a tick while the last enumeration is still running', async () => {
        let release: () => void = () => undefined
        fake.gate = new Promise((r) => (release = r))
        fake.devices = [KEYBOARD]
        stop = startHidDevicePolling(() => [win as never], 2000)
        await vi.advanceTimersByTimeAsync(6000)
        expect(fake.asyncCalls).toBe(1)

        fake.gate = null
        release()
        await vi.advanceTimersByTimeAsync(2000)
        expect(fake.asyncCalls).toBe(2)
    })
})
