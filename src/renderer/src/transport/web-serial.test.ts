// Pattern check: no GoF pattern (-) — rejected — regression tests; build fake
// SerialPorts and assert vid:pid dedup, open-timeout, and try-each-port connect.
//
// Covers the connection-system fixes for a device that enumerates several CDC
// ACM ports under one vid:pid (plus Chrome's accumulated stale grants): the
// list must collapse to one card, a hung port.open() must not stick, and
// connect must try each port until one opens.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// web-serial.ts calls registerTransport() at import time, which pulls in the
// firmware barrel (and the zmk-studio-ts-client dep). This unit test only
// exercises the pure port helpers, so stub the registry to keep the import
// graph light.
vi.mock('@/transport/adapter/registry', () => ({
    registerTransport: () => undefined,
}))

import {
    makeId,
    groupPortsByVidPid,
    openWithTimeout,
    listGrantedPorts,
    connectToGrantedPort,
} from './web-serial'

interface FakePortOpts {
    open?: () => Promise<void>
}

// Minimal SerialPort stand-in. `open()` flips readable/writable on so
// openTransport's `port.readable!` deref succeeds, mirroring a real open.
function fakePort(
    vid: number | undefined,
    pid: number | undefined,
    opts: FakePortOpts = {},
): SerialPort {
    const port = {
        getInfo: () => ({ usbVendorId: vid, usbProductId: pid }),
        readable: null as unknown,
        writable: null as unknown,
        close: vi.fn(async () => undefined),
        open:
            opts.open ??
            async function (this: { readable: unknown; writable: unknown }) {
                this.readable = {}
                this.writable = {}
            },
    }
    // Bind open() to the object so `this` mutation lands on the port.
    port.open = port.open.bind(port)
    return port as unknown as SerialPort
}

describe('makeId', () => {
    it('keys on vid:pid only — stable across enumeration order (no index)', () => {
        const a = makeId({ usbVendorId: 0x1d50, usbProductId: 0x615e })
        const b = makeId({ usbVendorId: 0x1d50, usbProductId: 0x615e })
        expect(a).toBe(b)
        expect(a).toBe('web-serial:1d50:615e')
    })

    it('falls back for missing vid/pid', () => {
        expect(makeId({})).toBe('web-serial:novid:nopid')
    })
})

describe('groupPortsByVidPid', () => {
    it('collapses same vid:pid into one group, preserving order', () => {
        const p1 = fakePort(0x1d50, 0x615e)
        const p2 = fakePort(0x1d50, 0x615e)
        const p3 = fakePort(0x1d50, 0x615e)
        const groups = groupPortsByVidPid([p1, p2, p3])
        expect(groups.size).toBe(1)
        expect(groups.get('web-serial:1d50:615e')).toEqual([p1, p2, p3])
    })

    it('keeps distinct vid:pid separate', () => {
        const groups = groupPortsByVidPid([
            fakePort(0x1d50, 0x615e),
            fakePort(0x239a, 0x0001),
        ])
        expect(groups.size).toBe(2)
    })
})

describe('openWithTimeout', () => {
    beforeEach(() => vi.useFakeTimers())
    afterEach(() => vi.useRealTimers())

    it('resolves when open resolves', async () => {
        const port = fakePort(1, 2, { open: async () => undefined })
        await expect(openWithTimeout(port)).resolves.toBeUndefined()
    })

    it('rejects + closes the port when open hangs past the timeout', async () => {
        const port = fakePort(1, 2, { open: () => new Promise<void>(() => {}) })
        const pending = openWithTimeout(port)
        const assertion = expect(pending).rejects.toThrow(/Timed out/)
        await vi.advanceTimersByTimeAsync(8_000)
        await assertion
        expect(
            (port as unknown as { close: ReturnType<typeof vi.fn> }).close,
        ).toHaveBeenCalled()
    })

    it('propagates an open() rejection', async () => {
        const boom = new Error('nope')
        const port = fakePort(1, 2, { open: async () => Promise.reject(boom) })
        await expect(openWithTimeout(port)).rejects.toBe(boom)
    })
})

describe('list + connect (dedup + try-each)', () => {
    beforeEach(() => {
        vi.stubGlobal('navigator', {
            serial: { getPorts: vi.fn() },
        })
    })
    afterEach(() => vi.unstubAllGlobals())

    async function seed(ports: SerialPort[]): Promise<void> {
        ;(
            navigator.serial.getPorts as ReturnType<typeof vi.fn>
        ).mockResolvedValue(ports)
        await listGrantedPorts()
    }

    it('lists one card for three same-vid:pid ports', async () => {
        ;(
            navigator.serial.getPorts as ReturnType<typeof vi.fn>
        ).mockResolvedValue([
            fakePort(0x1d50, 0x615e),
            fakePort(0x1d50, 0x615e),
            fakePort(0x1d50, 0x615e),
        ])
        const list = await listGrantedPorts()
        expect(list).toHaveLength(1)
        expect(list[0].id).toBe('web-serial:1d50:615e')
    })

    it('connect tries the next port when the first fails to open', async () => {
        const dead = fakePort(0x1d50, 0x615e, {
            open: async () => Promise.reject(new Error('dead port')),
        })
        const live = fakePort(0x1d50, 0x615e)
        await seed([dead, live])

        const tx = await connectToGrantedPort({
            id: 'web-serial:1d50:615e',
            label: 'x',
        })
        expect(tx.readable).toBeTruthy()
        // dead was attempted first (threw), then live opened successfully
        expect(dead.readable).toBeFalsy()
        expect(live.readable).toBeTruthy()
    })

    it('throws when every port fails to open', async () => {
        await seed([
            fakePort(0x1d50, 0x615e, {
                open: async () => Promise.reject(new Error('a')),
            }),
            fakePort(0x1d50, 0x615e, {
                open: async () => Promise.reject(new Error('b')),
            }),
        ])
        await expect(
            connectToGrantedPort({ id: 'web-serial:1d50:615e', label: 'x' }),
        ).rejects.toThrow()
    })

    it('throws a clear error for an unknown device id', async () => {
        await seed([fakePort(0x1d50, 0x615e)])
        await expect(
            connectToGrantedPort({ id: 'web-serial:dead:beef', label: 'x' }),
        ).rejects.toThrow(/no longer available/)
    })
})
