import { afterEach, describe, expect, it, vi } from 'vitest'
import { LockedError } from '@firmware/errors'
import type { KeyboardService } from '@firmware/service'
import type { LockKind, UnlockOptions } from '@firmware/types'
import useUnlockPromptStore, {
    dismissUnlockPrompt,
} from '@/stores/unlockPromptStore'
import { withUnlockPrompt } from './unlockPrompt'

/** A board that refuses setKey / setEncoder while locked, like Vial's guards. */
interface Fake {
    service: KeyboardService
    unlock: ReturnType<typeof vi.fn>
    refuseWhileLocked: ReturnType<typeof vi.fn>
}

function fakeService(
    lock: LockKind,
    opts: { unlockHangs?: boolean } = {},
): Fake {
    let locked = true
    const refuseWhileLocked = vi.fn(async (): Promise<string> => {
        if (locked) throw new LockedError()
        return 'written'
    })
    const unlock = vi.fn(async (o: UnlockOptions = {}): Promise<void> => {
        o.onProgress?.({ keys: [0, 3], progress: 0 })
        if (opts.unlockHangs) {
            await new Promise<void>((_, reject) =>
                o.signal?.addEventListener('abort', () =>
                    reject(new Error('aborted')),
                ),
            )
        }
        o.onProgress?.({ keys: [0, 3], progress: 1 })
        locked = false
    })
    const service = {
        capabilities: { lock },
        setKey: refuseWhileLocked,
        encoders: { setEncoder: refuseWhileLocked },
        buildKeyAction: () => 'sync',
        unlock,
    } as unknown as KeyboardService
    return { service, unlock, refuseWhileLocked }
}

afterEach(() => dismissUnlockPrompt())

describe('withUnlockPrompt', () => {
    it('unlocks and retries a refused call on an actions lock', async () => {
        const { service, unlock } = fakeService('actions')
        const wrapped = withUnlockPrompt(service)
        await expect(wrapped.setKey(0, 0, {} as never)).resolves.toBe('written')
        expect(unlock).toHaveBeenCalledOnce()
        expect(useUnlockPromptStore.getState().status).toBe('idle')
    })

    it('covers facade methods too', async () => {
        const { service } = fakeService('actions')
        const wrapped = withUnlockPrompt(service)
        await expect(
            wrapped.encoders!.setEncoder(0, 0, 0, {} as never),
        ).resolves.toBe('written')
        expect(wrapped.encoders).toBe(wrapped.encoders)
    })

    it('shows the combo while unlocking and rethrows when cancelled', async () => {
        const { service } = fakeService('actions', { unlockHangs: true })
        const wrapped = withUnlockPrompt(service)
        const call = wrapped.setKey(0, 0, {} as never)
        await vi.waitFor(() =>
            expect(useUnlockPromptStore.getState().keys).toEqual([0, 3]),
        )
        expect(useUnlockPromptStore.getState().status).toBe('unlocking')
        useUnlockPromptStore.getState().cancel()
        await expect(call).rejects.toBeInstanceOf(LockedError)
        expect(useUnlockPromptStore.getState().status).toBe('idle')
    })

    it('leaves editor locks to the locked overlay', async () => {
        const { service, unlock } = fakeService('editor')
        const wrapped = withUnlockPrompt(service)
        await expect(wrapped.setKey(0, 0, {} as never)).rejects.toBeInstanceOf(
            LockedError,
        )
        expect(unlock).not.toHaveBeenCalled()
    })

    it('passes sync results through unchanged', () => {
        const { service } = fakeService('actions')
        expect(withUnlockPrompt(service).buildKeyAction('x', [])).toBe('sync')
    })
})
