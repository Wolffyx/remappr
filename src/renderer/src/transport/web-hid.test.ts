// pattern-check: skip — unit test with navigator.hid faked, no production logic
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Transport } from '@firmware'

/* A granted WebHID device: an EventTarget with open/close/sendReport. */
class FakeHidDevice extends EventTarget {
    opened = false
    closed = 0
    readonly vendorId = 0x1d50
    readonly collections = [
        { usagePage: 0xff00, usage: 1, outputReports: [{ reportId: 0 }] },
    ]

    constructor(
        readonly productId: number,
        readonly productName: string,
    ) {
        super()
    }

    async open(): Promise<void> {
        this.opened = true
    }

    async close(): Promise<void> {
        this.opened = false
        this.closed++
    }

    async sendReport(): Promise<void> {
        /* reports go nowhere in this fake */
    }
}

const keyboard = new FakeHidDevice(0x0001, 'Keyboard')
const dongle = new FakeHidDevice(0x0002, 'Dongle')
const hid = Object.assign(new EventTarget(), {
    getDevices: async () => [keyboard, dongle],
})

vi.stubGlobal('navigator', { hid })

const { listGrantedDevices, connectToGrantedDevice } = await import('./web-hid')

function unplug(device: FakeHidDevice): void {
    hid.dispatchEvent(Object.assign(new Event('disconnect'), { device }))
}

/* Resolves when the readable ends; never resolves while it stays open. */
function ended(t: Transport): Promise<'ended'> {
    const reader = t.readable.getReader()
    return (async () => {
        for (;;) {
            if ((await reader.read()).done) return 'ended' as const
        }
    })()
}

const settle = (): Promise<'open'> =>
    new Promise((r) => setTimeout(() => r('open'), 10))

let open: Transport[] = []

async function connect(device: FakeHidDevice): Promise<Transport> {
    const list = await listGrantedDevices([])
    const entry = list.find((d) => d.label === device.productName)!
    const t = await connectToGrantedDevice(entry)
    open.push(t)
    return t
}

beforeEach(() => {
    keyboard.closed = 0
    dongle.closed = 0
})

afterEach(() => {
    for (const t of open) t.abortController.abort()
    open = []
})

describe('WebHID transport (L4.6)', () => {
    it('ends the transport when its device is unplugged', async () => {
        const t = await connect(keyboard)
        const done = ended(t)
        unplug(keyboard)
        expect(await Promise.race([done, settle()])).toBe('ended')
    })

    it("ignores another device's unplug", async () => {
        const t = await connect(keyboard)
        const done = ended(t)
        unplug(dongle)
        expect(await Promise.race([done, settle()])).toBe('open')
    })

    it('stops listening once the transport is closed', async () => {
        const t = await connect(keyboard)
        t.abortController.abort()
        await settle()
        const closes = keyboard.closed
        unplug(keyboard)
        await settle()
        expect(keyboard.closed).toBe(closes)
    })
})
