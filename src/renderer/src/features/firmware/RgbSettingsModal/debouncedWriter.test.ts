// pattern-check: skip — assertions over the debounced RGB writer
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { DebouncedWriter } from './debouncedWriter'

describe('DebouncedWriter', () => {
    beforeEach(() => vi.useFakeTimers())
    afterEach(() => vi.useRealTimers())

    const make = (
        write: (v: number) => Promise<unknown>,
    ): { w: DebouncedWriter<number>; onRejected: ReturnType<typeof vi.fn> } => {
        const onRejected = vi.fn()
        const w = new DebouncedWriter<number>({
            write,
            onRejected,
            delayMs: 90,
        })
        return { w, onRejected }
    }

    it('sends only the latest value once the debounce passes', async () => {
        const write = vi.fn(async () => {})
        const { w } = make(write)
        w.set(1)
        w.set(2)
        w.set(3)
        await vi.advanceTimersByTimeAsync(90)
        expect(write.mock.calls).toEqual([[3]])
    })

    // L4.19: a refused write was fire-and-forget, so the UI kept a value the
    // device never took.
    it('hands back the last accepted value when a write is refused', async () => {
        const write = vi.fn(async (v: number) => {
            if (v === 9) throw new Error('ERR_BOUNDS')
        })
        const { w, onRejected } = make(write)
        w.accept(4)
        w.set(5)
        await vi.advanceTimersByTimeAsync(90)
        w.set(9)
        await vi.advanceTimersByTimeAsync(90)

        expect(onRejected).toHaveBeenCalledTimes(1)
        expect(onRejected.mock.calls[0][0]).toBe(5)
        expect((onRejected.mock.calls[0][1] as Error).message).toBe(
            'ERR_BOUNDS',
        )
    })

    it('does not roll back over a newer value queued meanwhile', async () => {
        let reject: (e: Error) => void = () => {}
        const write = vi
            .fn<(v: number) => Promise<unknown>>()
            .mockImplementationOnce(
                () =>
                    new Promise((_, r) => {
                        reject = r
                    }),
            )
            .mockResolvedValue(undefined)
        const { w, onRejected } = make(write)
        w.accept(1)
        w.set(2)
        await vi.advanceTimersByTimeAsync(90) // 2 in flight
        w.set(3) // queued
        reject(new Error('busy'))
        await vi.advanceTimersByTimeAsync(90)

        expect(onRejected).not.toHaveBeenCalled()
        expect(write.mock.calls.map((c) => c[0])).toEqual([2, 3])
    })

    it('flush sends the queued value at once', async () => {
        const write = vi.fn(async () => {})
        const { w } = make(write)
        w.set(7)
        await w.flush()
        expect(write).toHaveBeenCalledWith(7)
        await vi.advanceTimersByTimeAsync(200)
        expect(write).toHaveBeenCalledTimes(1)
    })
})
