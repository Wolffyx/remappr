// pattern-check: skip — unit tests for the device editor store and binding commands.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MockDeviceService } from '@firmware/clients/mock/devices/MockDeviceService'
import { HALO_M2 } from '@firmware/clients/mock/devices/haloM2'
import { GENERIC_GAMEPAD } from '@firmware/clients/mock/devices/genericGamepad'
import undoRedoStore from '@/stores/undoRedoStore'
import { bindingCommand, mergeBinding } from './bindingMutations'
import useDeviceEditorStore, { selectActiveBindings } from './deviceEditorStore'

vi.mock('sonner', () => ({ toast: { error: vi.fn() } }))

const store = useDeviceEditorStore

beforeEach(() => {
    store.getState().reset()
    undoRedoStore.getState().reset()
})

async function loadHalo(): Promise<MockDeviceService> {
    const svc = new MockDeviceService(HALO_M2)
    await store.getState().load(svc.controls)
    return svc
}

describe('deviceEditorStore', () => {
    it('loads model, catalog, profiles and the active bindings', async () => {
        await loadHalo()
        const s = store.getState()
        expect(s.status).toBe('ready')
        expect(s.loaded?.model.name).toBe('Halo M2')
        expect(s.profiles.map((p) => p.name)).toEqual([
            'Default',
            'Gaming',
            'Work',
        ])
        expect(s.activeProfileId).toBe('p0')
        expect(selectActiveBindings(s).lmb).toEqual({ a: 'mouse:Left click' })
    })

    it('drops a late reply from a device that was swapped out', async () => {
        const first = new MockDeviceService(HALO_M2)
        const second = new MockDeviceService(GENERIC_GAMEPAD)
        const pending = store.getState().load(first.controls)
        await store.getState().load(second.controls)
        await pending
        expect(store.getState().loaded?.model.name).toBe('Generic USB Gamepad')
    })

    it('fetches a profile the first time it is shown', async () => {
        await loadHalo()
        await store.getState().showProfile('p1')
        const s = store.getState()
        expect(s.activeProfileId).toBe('p1')
        expect(selectActiveBindings(s).back).toEqual({ a: 'key:R' })
    })

    it('reloads after a stock reset on the device', async () => {
        const svc = await loadHalo()
        store.getState().putBinding('p0', 'lmb', { a: null })
        await svc.resetSettings()
        await store.getState().applyChange({ type: 'profiles' })
        expect(selectActiveBindings(store.getState()).lmb).toEqual({
            a: 'mouse:Left click',
        })
    })

    it('adds a profile and shows it', async () => {
        await loadHalo()
        await store.getState().addProfile('Travel')
        const s = store.getState()
        expect(s.profiles.at(-1)?.name).toBe('Travel')
        expect(s.activeProfileId).toBe(s.profiles.at(-1)?.id)
    })
})

describe('binding commands', () => {
    it('writes optimistically and undoes into the original profile', async () => {
        const svc = await loadHalo()
        const put = store.getState().putBinding
        const edit = {
            controls: svc.controls,
            profileId: 'p0',
            controlId: 'lmb',
            prev: { a: 'mouse:Left click' },
            next: { a: 'mouse:Right click' },
        }
        await undoRedoStore.getState().doIt(bindingCommand(edit, put))
        expect((await svc.controls.getBindings('p0')).lmb).toEqual(edit.next)
        await store.getState().showProfile('p2')
        await undoRedoStore.getState().undo()
        expect((await svc.controls.getBindings('p0')).lmb).toEqual(edit.prev)
        expect(store.getState().bindings.p0?.lmb).toEqual(edit.prev)
        expect(store.getState().activeProfileId).toBe('p2')
    })

    it('reverts and pushes nothing when the device refuses', async () => {
        const svc = await loadHalo()
        const controls = {
            ...svc.controls,
            setBinding: () => Promise.reject(new Error('nope')),
        }
        const edit = {
            controls,
            profileId: 'p0',
            controlId: 'lmb',
            prev: { a: 'mouse:Left click' },
            next: { a: null },
        }
        await undoRedoStore
            .getState()
            .doIt(bindingCommand(edit, store.getState().putBinding))
        expect(store.getState().bindings.p0?.lmb).toEqual(edit.prev)
        expect(undoRedoStore.getState().canUndo()).toBe(false)
    })

    it('merges a patch and removes fields set to undefined', () => {
        expect(
            mergeBinding(
                { a: 'x', hold: 'y' },
                { hold: undefined, turbo: true },
            ),
        ).toEqual({ a: 'x', turbo: true })
    })
})
