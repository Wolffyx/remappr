// pattern-check: skip — unit test with window.api faked, no production logic
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Transport } from '@firmware'
import {
    IpcChannels,
    IpcEvents,
    type LinkId,
} from '../../../../shared/ipc-types'
import {
    electronIpc,
    type IpcConnectResult,
    IpcTransportAdapter,
    linkIdOf,
} from './ipc-adapter'

/* One main process: every listener hears every event, like ipcRenderer.on. */
function fakeApi(): {
    api: {
        invoke: (channel: string, ...args: unknown[]) => Promise<unknown>
        on: (channel: string, cb: (...args: unknown[]) => void) => () => void
    }
    emitData: (linkId: LinkId, data: number[]) => void
    emitDisconnect: (linkId: LinkId) => void
    invokes: unknown[][]
} {
    const listeners = new Map<string, Set<(...args: unknown[]) => void>>()
    const invokes: unknown[][] = []
    const emit = (channel: string, payload: unknown): void =>
        listeners.get(channel)?.forEach((cb) => cb(payload))
    return {
        invokes,
        api: {
            async invoke(channel, ...args) {
                invokes.push([channel, ...args])
            },
            on(channel, cb) {
                const set = listeners.get(channel) ?? new Set()
                set.add(cb)
                listeners.set(channel, set)
                return () => set.delete(cb)
            },
        },
        emitData: (linkId, data) =>
            emit(IpcEvents.CONNECTION_DATA, { linkId, data }),
        emitDisconnect: (linkId) =>
            emit(IpcEvents.CONNECTION_DISCONNECTED, { linkId }),
    }
}

class FakeAdapter extends IpcTransportAdapter {
    constructor(private readonly link: LinkId) {
        super(electronIpc, 'fake')
    }

    protected async connectIpc(): Promise<IpcConnectResult> {
        return { linkId: this.link }
    }
}

/* Collect what the transport's readable yields until it closes. */
function drain(t: Transport): { chunks: number[][]; done: Promise<void> } {
    const chunks: number[][] = []
    const reader = t.readable.getReader()
    const done = (async (): Promise<void> => {
        for (;;) {
            const r = await reader.read()
            if (r.done) return
            chunks.push(Array.from(r.value))
        }
    })()
    return { chunks, done }
}

const tick = (): Promise<void> => new Promise((r) => setTimeout(r, 0))

let ipc: ReturnType<typeof fakeApi>

beforeEach(() => {
    ipc = fakeApi()
    vi.stubGlobal('window', { api: ipc.api })
})

afterEach(() => {
    vi.unstubAllGlobals()
})

describe('IpcTransportAdapter link ids (L4.1)', () => {
    it("passes on only its own link's data", async () => {
        const a = drain(await new FakeAdapter(1).connect())
        const b = drain(await new FakeAdapter(2).connect())

        ipc.emitData(2, [0xaa])
        ipc.emitData(1, [0xbb])
        await tick()

        expect(a.chunks).toEqual([[0xbb]])
        expect(b.chunks).toEqual([[0xaa]])
    })

    it("ends only on its own link's disconnect", async () => {
        const a = drain(await new FakeAdapter(1).connect())
        const b = drain(await new FakeAdapter(2).connect())

        ipc.emitDisconnect(1)
        await a.done
        ipc.emitData(2, [0xcc])
        await tick()

        expect(b.chunks).toEqual([[0xcc]])
    })

    it('names its link in sends and in the close', async () => {
        const t = await new FakeAdapter(7).connect()
        const w = t.writable.getWriter()
        await w.write(new Uint8Array([1, 2]))
        t.abortController.abort()
        await tick()

        expect(ipc.invokes).toEqual([
            [IpcChannels.TRANSPORT_SEND_DATA, 7, new Uint8Array([1, 2])],
            [IpcChannels.TRANSPORT_CLOSE, 7],
        ])
    })

    it('refuses a connect answer that names no link', () => {
        expect(() => linkIdOf({})).toThrow(/no link/)
        expect(linkIdOf({ linkId: 3 })).toBe(3)
    })
})
