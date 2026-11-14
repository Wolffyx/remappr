// pattern-check: skip — unit tests with a fake service and mocked toast
import { afterEach, describe, expect, it, vi } from 'vitest'

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))
vi.mock('sonner', () => ({ toast }))

import type { KeyboardService } from '@firmware/service'
import useSaveAllPromptStore from '@/stores/saveAllPromptStore'
import { saveConfigSection } from './saveConfigSection'
import { saveSucceeded } from './saveWithToast'

function fakeService(opts: {
    saveMode: 'manual' | 'automatic'
    pending: boolean
    commit?: () => Promise<void>
}): KeyboardService {
    return {
        deviceInfo: { name: 'KB' },
        capabilities: { saveMode: opts.saveMode },
        hasPendingChanges: () => opts.pending,
        commit: vi.fn(opts.commit ?? (async () => undefined)),
        discardChanges: vi.fn(async () => undefined),
    } as unknown as KeyboardService
}

const save = (service: KeyboardService, stage = vi.fn()): Promise<boolean> =>
    saveConfigSection({
        service,
        section: 'Power settings',
        stage,
        successMessage: 'Power settings saved',
        errorPrefix: 'Failed to save power settings',
    })

const prompt = (): ReturnType<typeof useSaveAllPromptStore.getState> =>
    useSaveAllPromptStore.getState()

afterEach(() => {
    toast.success.mockClear()
    toast.error.mockClear()
    if (prompt().deviceName !== null) prompt().choose(false)
})

describe('saveConfigSection (L4.13)', () => {
    it('saves at once when nothing else is staged', async () => {
        const svc = fakeService({ saveMode: 'manual', pending: false })
        const stage = vi.fn()
        await expect(save(svc, stage)).resolves.toBe(true)
        expect(stage).toHaveBeenCalledOnce()
        expect(svc.commit).toHaveBeenCalledOnce()
        expect(toast.success).toHaveBeenCalledWith('Power settings saved')
    })

    it('asks before also saving other unsaved edits, and Cancel stages nothing', async () => {
        const svc = fakeService({ saveMode: 'manual', pending: true })
        const stage = vi.fn()
        const result = save(svc, stage)
        await vi.waitFor(() => expect(prompt().deviceName).toBe('KB'))
        expect(prompt().section).toBe('Power settings')
        prompt().choose(false)
        await expect(result).resolves.toBe(false)
        expect(stage).not.toHaveBeenCalled()
        expect(svc.commit).not.toHaveBeenCalled()
    })

    it('Save all stages and saves everything', async () => {
        const svc = fakeService({ saveMode: 'manual', pending: true })
        const result = save(svc)
        await vi.waitFor(() => expect(prompt().deviceName).toBe('KB'))
        prompt().choose(true)
        await expect(result).resolves.toBe(true)
        expect(svc.commit).toHaveBeenCalledOnce()
    })

    it('does not ask with Auto-save on (those edits save anyway)', async () => {
        const svc = fakeService({ saveMode: 'automatic', pending: true })
        await expect(save(svc)).resolves.toBe(true)
        expect(prompt().deviceName).toBeNull()
    })

    it('a failed save drops the section so it cannot ride along later', async () => {
        const svc = fakeService({
            saveMode: 'manual',
            pending: false,
            commit: async () => {
                throw new Error('COMMIT_CONFIG failed: ERR_ACTIVATE')
            },
        })
        await expect(save(svc)).resolves.toBe(false)
        expect(svc.discardChanges).toHaveBeenCalledOnce()
        expect(toast.error).toHaveBeenCalledWith(
            'Failed to save power settings: The device stored the config but could not apply it.',
            expect.objectContaining({
                description: expect.stringContaining('ERR_ACTIVATE'),
            }),
        )
    })

    it('a failed save keeps edits the user chose to save together', async () => {
        const svc = fakeService({
            saveMode: 'automatic',
            pending: true,
            commit: async () => {
                throw new Error('COMMIT_CONFIG failed: ERR_STATE')
            },
        })
        await expect(save(svc)).resolves.toBe(false)
        expect(svc.discardChanges).not.toHaveBeenCalled()
    })
})

describe('saveSucceeded (L4.16)', () => {
    it('is true for a Promise<void> setter that resolved', async () => {
        await expect(
            saveSucceeded(async () => undefined, 'ok', 'Failed'),
        ).resolves.toBe(true)
    })

    it('is false when the setter threw', async () => {
        await expect(
            saveSucceeded(
                async () => {
                    throw new Error('nope')
                },
                'ok',
                'Failed',
            ),
        ).resolves.toBe(false)
        expect(toast.error).toHaveBeenCalledWith('Failed: nope', {})
    })
})
