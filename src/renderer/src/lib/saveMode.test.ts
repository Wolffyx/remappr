// Pattern check: no GoF pattern (-) — rejected — unit tests; fake services +
// fake timers assert staging, passthrough, debounced auto-commit, mode flips.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('sonner', () => ({ toast: { error: vi.fn() } }))

import { toast } from 'sonner'
import type { KeyboardService } from '@firmware/service'
import type { KeyAction } from '@firmware/types'
import {
    withSaveMode,
    applySaveMode,
    isSaveModeManaged,
    unwrapSaveMode,
} from './saveMode'

const action = (kind: string): KeyAction =>
    ({ kind, params: [] }) as unknown as KeyAction

interface FakeOpts {
    saveMode?: 'manual' | 'automatic' | 'none'
    readOnly?: boolean
    withEncoders?: boolean
}

function fakeService(opts: FakeOpts = {}): KeyboardService {
    let pending = false
    const listeners = new Set<(p: boolean) => void>()
    const svc = {
        deviceInfo: { name: 'Fake KB', firmware: 'fake' },
        capabilities: {
            saveMode: opts.saveMode ?? 'automatic',
            ...(opts.readOnly ? { readOnly: true } : {}),
        },
        setKey: vi.fn(async () => {
            if ((opts.saveMode ?? 'automatic') === 'manual') {
                pending = true
                for (const cb of listeners) cb(true)
            }
        }),
        setKeys: vi.fn(async () => undefined),
        commit: vi.fn(async () => {
            pending = false
            for (const cb of listeners) cb(false)
        }),
        discardChanges: vi.fn(async () => undefined),
        hasPendingChanges: vi.fn(() => pending),
        refreshPendingChanges: vi.fn(async () => pending),
        onPendingChangesChanged: vi.fn((cb: (p: boolean) => void) => {
            listeners.add(cb)
            return () => listeners.delete(cb)
        }),
        getKeymap: vi.fn(async () => ({ layers: [] })),
        ...(opts.withEncoders
            ? { encoders: { setEncoder: vi.fn(async () => undefined) } }
            : {}),
    }
    return svc as unknown as KeyboardService
}

describe('withSaveMode — wrapping rules', () => {
    it('identity for none / readOnly; wraps manual AND automatic', () => {
        const none = fakeService({ saveMode: 'none' })
        const ro = fakeService({ readOnly: true })
        expect(withSaveMode(none, false)).toBe(none)
        expect(withSaveMode(ro, false)).toBe(ro)
        const manual = fakeService({ saveMode: 'manual' })
        const auto = fakeService({ saveMode: 'automatic' })
        expect(withSaveMode(manual, false)).not.toBe(manual)
        expect(withSaveMode(auto, false)).not.toBe(auto)
    })

    it('does not double-wrap and unwraps to the base', () => {
        const base = fakeService()
        const svc = withSaveMode(base, false)
        expect(withSaveMode(svc, false)).toBe(svc)
        expect(isSaveModeManaged(svc)).toBe(true)
        expect(isSaveModeManaged(base)).toBe(false)
        expect(unwrapSaveMode(svc)).toBe(base)
    })

    it('derives capabilities.saveMode from the mode flag', async () => {
        const svc = withSaveMode(fakeService(), false)
        expect(svc.capabilities.saveMode).toBe('manual')
        await applySaveMode(svc, true)
        expect(svc.capabilities.saveMode).toBe('automatic')
        await applySaveMode(svc, false)
        expect(svc.capabilities.saveMode).toBe('manual')
    })
})

describe('underlying automatic (QMK-family)', () => {
    it('manual mode stages (last-wins) and commit flushes one batch', async () => {
        const base = fakeService()
        const svc = withSaveMode(base, false)
        const seen: boolean[] = []
        svc.onPendingChangesChanged((p) => seen.push(p))

        await svc.setKey(1, 0, action('kc_a'))
        await svc.setKey(1, 0, action('kc_b')) // overwrites
        await svc.setKey(1, 5, action('kc_c'))
        expect(base.setKey).not.toHaveBeenCalled()
        expect(svc.hasPendingChanges()).toBe(true)
        expect(seen).toEqual([true])

        await svc.commit()
        expect(base.setKeys).toHaveBeenCalledTimes(1)
        expect(base.setKeys).toHaveBeenCalledWith([
            { layerId: 1, position: 0, action: action('kc_b') },
            { layerId: 1, position: 5, action: action('kc_c') },
        ])
        expect(svc.hasPendingChanges()).toBe(false)
        expect(seen).toEqual([true, false])
    })

    it('manual-mode discard drops the queue without device calls', async () => {
        const base = fakeService()
        const svc = withSaveMode(base, false)
        await svc.setKey(0, 0, action('kc_z'))
        await svc.discardChanges()
        expect(svc.hasPendingChanges()).toBe(false)
        expect(base.discardChanges).not.toHaveBeenCalled()
        await svc.commit()
        expect(base.setKeys).not.toHaveBeenCalled()
    })

    it('failed flush keeps ops staged', async () => {
        const base = fakeService()
        ;(base.setKeys as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
            new Error('write failed'),
        )
        const svc = withSaveMode(base, false)
        await svc.setKey(0, 0, action('kc_a'))
        await expect(svc.commit()).rejects.toThrow('write failed')
        expect(svc.hasPendingChanges()).toBe(true)
        await svc.commit()
        expect(svc.hasPendingChanges()).toBe(false)
    })

    it('auto mode passes writes straight through', async () => {
        const base = fakeService()
        const svc = withSaveMode(base, true)
        await svc.setKey(2, 7, action('kc_q'))
        expect(base.setKey).toHaveBeenCalledWith(2, 7, action('kc_q'))
        expect(svc.hasPendingChanges()).toBe(false)
    })

    it('turning auto ON flushes staged edits first; flush failure propagates and keeps manual', async () => {
        const base = fakeService()
        ;(base.setKeys as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
            new Error('flush failed'),
        )
        const svc = withSaveMode(base, false)
        await svc.setKey(0, 0, action('kc_a'))
        await expect(applySaveMode(svc, true)).rejects.toThrow('flush failed')
        expect(svc.capabilities.saveMode).toBe('manual')
        expect(svc.hasPendingChanges()).toBe(true)
        await applySaveMode(svc, true) // succeeds now
        expect(svc.capabilities.saveMode).toBe('automatic')
        expect(svc.hasPendingChanges()).toBe(false)
    })

    it('stages encoder writes behind the facade in manual mode', async () => {
        const base = fakeService({ withEncoders: true })
        const svc = withSaveMode(base, false)
        await svc.encoders!.setEncoder(0, 1, 0, action('kc_up'))
        expect(base.encoders!.setEncoder).not.toHaveBeenCalled()
        await svc.commit()
        expect(base.encoders!.setEncoder).toHaveBeenCalledWith(
            0,
            1,
            0,
            action('kc_up'),
        )
    })
})

describe('underlying manual (ZMK/Remappr)', () => {
    beforeEach(() => vi.useFakeTimers())
    afterEach(() => vi.useRealTimers())

    it('manual mode is pure passthrough incl. pending delegation', async () => {
        const base = fakeService({ saveMode: 'manual' })
        const svc = withSaveMode(base, false)
        await svc.setKey(0, 0, action('kc_a'))
        expect(base.setKey).toHaveBeenCalled()
        expect(svc.hasPendingChanges()).toBe(true) // device truth
        await svc.commit()
        expect(base.commit).toHaveBeenCalledTimes(1)
        expect(svc.hasPendingChanges()).toBe(false)
    })

    it('auto mode debounces one commit after a burst of edits', async () => {
        const base = fakeService({ saveMode: 'manual' })
        const svc = withSaveMode(base, true)
        await svc.setKey(0, 0, action('kc_a'))
        await svc.setKey(0, 1, action('kc_b'))
        await svc.setKey(0, 2, action('kc_c'))
        expect(base.commit).not.toHaveBeenCalled()
        await vi.advanceTimersByTimeAsync(1_000)
        expect(base.commit).toHaveBeenCalledTimes(1)
    })

    it('auto-commit failure surfaces a toast', async () => {
        const base = fakeService({ saveMode: 'manual' })
        ;(base.commit as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
            new Error('NVS full'),
        )
        const svc = withSaveMode(base, true)
        await svc.setKey(0, 0, action('kc_a'))
        await vi.advanceTimersByTimeAsync(1_000)
        expect(toast.error).toHaveBeenCalledWith('NVS full')
    })

    it('switching back to manual cancels a pending auto-commit', async () => {
        const base = fakeService({ saveMode: 'manual' })
        const svc = withSaveMode(base, true)
        await svc.setKey(0, 0, action('kc_a'))
        await applySaveMode(svc, false)
        await vi.advanceTimersByTimeAsync(2_000)
        expect(base.commit).not.toHaveBeenCalled()
    })

    it('discard forwards to the device and cancels auto-commit', async () => {
        const base = fakeService({ saveMode: 'manual' })
        const svc = withSaveMode(base, true)
        await svc.setKey(0, 0, action('kc_a'))
        await svc.discardChanges()
        expect(base.discardChanges).toHaveBeenCalled()
        await vi.advanceTimersByTimeAsync(2_000)
        expect(base.commit).not.toHaveBeenCalled()
    })
})

describe('forwarding', () => {
    it('unrelated members pass through with stable identity', async () => {
        const base = fakeService()
        const svc = withSaveMode(base, false)
        expect(svc.deviceInfo).toBe(base.deviceInfo)
        expect(svc.getKeymap).toBe(svc.getKeymap)
        await svc.getKeymap()
        expect(base.getKeymap).toHaveBeenCalled()
    })
})
