// pattern-check: skip — unit tests; a fake device that logs its save steps
// shows whether two saves interleave and whether a left device still saves.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

import type { KeyboardService } from '@firmware/service'
import type { KeyAction } from '@firmware/types'
import { cancelAutoSave, withSaveMode } from './saveMode'

const action = { kind: 'kp', params: [] } as unknown as KeyAction

interface Deferred {
    promise: Promise<void>
    resolve: () => void
}
const deferred = (): Deferred => {
    let resolve!: () => void
    const promise = new Promise<void>((r) => (resolve = r))
    return { promise, resolve }
}

/** An on-device-staging (manual) service whose commit is a BEGIN … COMMIT
 *  sequence that waits on the test between the two steps. */
function stagingDevice(): {
    service: KeyboardService
    log: string[]
    gates: Deferred[]
} {
    const log: string[] = []
    const gates: Deferred[] = []
    let n = 0
    const service = {
        deviceInfo: { name: 'Fake', firmware: 'fake' },
        capabilities: { saveMode: 'manual' },
        setKey: vi.fn(async () => undefined),
        setKeys: vi.fn(async () => undefined),
        commit: vi.fn(async () => {
            const id = ++n
            const gate = deferred()
            gates.push(gate)
            log.push(`BEGIN ${id}`)
            await gate.promise
            log.push(`COMMIT ${id}`)
        }),
        discardChanges: vi.fn(async () => {
            log.push('ROLLBACK')
        }),
        disconnect: vi.fn(async () => undefined),
        hasPendingChanges: vi.fn(() => false),
        refreshPendingChanges: vi.fn(async () => false),
        onPendingChangesChanged: vi.fn(() => () => undefined),
    }
    return { service: service as unknown as KeyboardService, log, gates }
}

/** Let queued promise callbacks run. */
const flush = async (): Promise<void> => {
    for (let i = 0; i < 10; i++) await Promise.resolve()
}

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('commit mutex (L4.14)', () => {
    it('a Header save waits for an in-flight auto-save', async () => {
        const { service, log, gates } = stagingDevice()
        const svc = withSaveMode(service, true)
        await svc.setKey(0, 0, action)
        await vi.advanceTimersByTimeAsync(1_000) // auto-save starts
        expect(log).toEqual(['BEGIN 1'])

        const header = svc.commit() // user clicks Save meanwhile
        await flush()
        expect(log).toEqual(['BEGIN 1']) // not interleaved

        gates[0].resolve()
        await flush()
        expect(log).toEqual(['BEGIN 1', 'COMMIT 1', 'BEGIN 2'])
        gates[1].resolve()
        await header
        expect(log).toEqual(['BEGIN 1', 'COMMIT 1', 'BEGIN 2', 'COMMIT 2'])
    })

    it('a discard never rolls back a save in flight', async () => {
        const { service, log, gates } = stagingDevice()
        const svc = withSaveMode(service, false)
        const save = svc.commit()
        await flush()
        const discard = svc.discardChanges()
        await flush()
        expect(log).toEqual(['BEGIN 1'])
        gates[0].resolve()
        await Promise.all([save, discard])
        expect(log).toEqual(['BEGIN 1', 'COMMIT 1', 'ROLLBACK'])
    })

    it('a failed save releases the lock for the next one', async () => {
        const { service, log } = stagingDevice()
        vi.mocked(service.commit).mockRejectedValueOnce(new Error('ERR_STATE'))
        const svc = withSaveMode(service, false)
        await expect(svc.commit()).rejects.toThrow('ERR_STATE')
        // The rejected call never reached the fake's body, so this is its
        // first real run: it starts at once instead of waiting forever.
        void svc.commit()
        await flush()
        expect(log).toEqual(['BEGIN 1'])
    })
})

describe('auto-save timer on leave (L4.15)', () => {
    it('disconnect cancels a pending auto-save', async () => {
        const { service } = stagingDevice()
        const svc = withSaveMode(service, true)
        await svc.setKey(0, 0, action)
        await svc.disconnect()
        await vi.advanceTimersByTimeAsync(5_000)
        expect(service.commit).not.toHaveBeenCalled()
    })

    it('cancelAutoSave (switch / unplug) cancels a pending auto-save', async () => {
        const { service } = stagingDevice()
        const svc = withSaveMode(service, true)
        await svc.setKey(0, 0, action)
        cancelAutoSave(svc)
        await vi.advanceTimersByTimeAsync(5_000)
        expect(service.commit).not.toHaveBeenCalled()
    })

    it('cancelAutoSave is a no-op for an unmanaged service', () => {
        const { service } = stagingDevice()
        expect(() => cancelAutoSave(service)).not.toThrow()
        expect(() => cancelAutoSave(null)).not.toThrow()
    })
})
