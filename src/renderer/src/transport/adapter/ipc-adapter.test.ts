// pattern-check: skip — unit test with a fake PlatformIpc, no production logic
import { describe, expect, it } from 'vitest'
import type { Transport } from '@firmware'
import {
    type IpcConnectResult,
    IpcTransportAdapter,
    type PlatformIpc,
} from './ipc-adapter'

/* One main process: listeners get every event, like ipcRenderer.on. */
function fakePlatform(): PlatformIpc & {
    emitData: (bytes: number[], id?: number) => void
    emitDisconnect: (id?: number) => void
    sends: [number[], number | undefined][]
    closes: (number | undefined)[]
} {
    const data = new Set<(b: Uint8Array, id?: number) => void>()
    const disc = new Set<(id?: number) => void>()
    const sends: [number[], number | undefined][] = []
    const closes: (number | undefined)[] = []
    return {
        sends,
        closes,
        async sendData(d, id) {
            sends.push([Array.from(d), id])
        },
        async close(id) {
            closes.push(id)
        },
        async onConnectionData(cb) {
            data.add(cb)
            return () => data.delete(cb)
        },
        async onConnectionDisconnected(cb) {
            disc.add(cb)
            return () => disc.delete(cb)
        },
        emitData: (bytes, id) =>
            data.forEach((cb) => cb(new Uint8Array(bytes), id)),
        emitDisconnect: (id) => disc.forEach((cb) => cb(id)),
    }
}

class FakeAdapter extends IpcTransportAdapter {
    constructor(
        platform: PlatformIpc,
        private readonly id: number | undefined,
    ) {
        super(platform, 'fake')
    }

    protected async connectIpc(): Promise<IpcConnectResult> {
        return { connectionId: this.id }
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

describe('IpcTransportAdapter connection ids (L4.1)', () => {
    it("passes on only its own connection's data", async () => {
        const p = fakePlatform()
        const a = drain(await new FakeAdapter(p, 1).connect())
        const b = drain(await new FakeAdapter(p, 2).connect())

        p.emitData([0xaa], 2)
        p.emitData([0xbb], 1)
        await tick()

        expect(a.chunks).toEqual([[0xbb]])
        expect(b.chunks).toEqual([[0xaa]])
    })

    it("ends only on its own connection's disconnect", async () => {
        const p = fakePlatform()
        const a = drain(await new FakeAdapter(p, 1).connect())
        const b = drain(await new FakeAdapter(p, 2).connect())

        p.emitDisconnect(1)
        await a.done
        p.emitData([0xcc], 2)
        await tick()

        expect(b.chunks).toEqual([[0xcc]])
    })

    it('names its connection in sends and in the close', async () => {
        const p = fakePlatform()
        const t = await new FakeAdapter(p, 7).connect()
        const w = t.writable.getWriter()
        await w.write(new Uint8Array([1, 2]))
        t.abortController.abort()
        await tick()

        expect(p.sends).toEqual([[[1, 2], 7]])
        expect(p.closes).toEqual([7])
    })

    it('takes every event when the connect gave no id', async () => {
        const p = fakePlatform()
        const a = drain(await new FakeAdapter(p, undefined).connect())
        p.emitData([1], 5)
        p.emitData([2])
        await tick()
        expect(a.chunks).toEqual([[1], [2]])
    })
})
