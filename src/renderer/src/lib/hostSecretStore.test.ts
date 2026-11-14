// pattern-check: skip — adapter test with mocked toast, no production logic
import { afterEach, describe, expect, it, vi } from 'vitest'

const toast = vi.hoisted(() => ({ warning: vi.fn() }))
vi.mock('sonner', () => ({ toast }))

import {
    SECURE_STORAGE_UNAVAILABLE_MESSAGE,
    setHostSecret,
} from './hostSecretStore'

afterEach(() => {
    vi.unstubAllGlobals()
    toast.warning.mockClear()
})

describe('host secret store (L4.24)', () => {
    it('warns instead of rejecting when secure storage is unavailable', async () => {
        const local = new Map<string, string>()
        vi.stubGlobal('localStorage', {
            getItem: (k: string) => local.get(k) ?? null,
            setItem: (k: string, v: string) => void local.set(k, v),
            removeItem: (k: string) => void local.delete(k),
        })
        vi.stubGlobal('api', { invoke: vi.fn(async () => false) })
        await expect(
            setHostSecret('client.identity', 'aa'),
        ).resolves.toBeUndefined()
        expect(local.size).toBe(0)
        expect(toast.warning).toHaveBeenCalledWith(
            SECURE_STORAGE_UNAVAILABLE_MESSAGE,
            expect.objectContaining({ id: expect.any(String) }),
        )
    })

    it('stays quiet when the encrypted store accepts the value', async () => {
        vi.stubGlobal('localStorage', {
            getItem: () => null,
            setItem: vi.fn(),
            removeItem: vi.fn(),
        })
        vi.stubGlobal('api', { invoke: vi.fn(async () => true) })
        await setHostSecret('client.identity', 'aa')
        expect(toast.warning).not.toHaveBeenCalled()
    })
})
