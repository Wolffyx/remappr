// pattern-check: skip — unit tests for the device builder store's history and hand-offs.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { STOCK_MOUSE } from '@firmware/devices/stockLayouts'
import type { DeviceModel } from '@firmware/devices/types'

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock('@firmware', () => ({ connectMockDeviceWithModel: vi.fn() }))

import { toast } from 'sonner'
import useBuilderStore from '@/stores/builderStore'
import useConnectionStore from '@/stores/connectionStore'
import { moveControl } from '@/lib/devices/layoutOps'
import useDeviceBuilderStore from './deviceBuilderStore'

const mouse: DeviceModel = {
    kind: 'mouse',
    form: 'mouse',
    name: 'M',
    ...STOCK_MOUSE,
}
const store = useDeviceBuilderStore

beforeEach(() => store.getState().start(mouse, 'new'))

describe('deviceBuilderStore', () => {
    it('records a whole drag as one undo step', () => {
        const s = store.getState()
        s.beginGesture()
        s.live(moveControl(mouse, 'dpi', 3, 3))
        store.getState().live(moveControl(mouse, 'dpi', 4, 4))
        store.getState().endGesture()
        expect(store.getState().past).toHaveLength(1)
        store.getState().undo()
        expect(store.getState().layout).toBe(mouse)
        store.getState().redo()
        expect(
            store.getState().layout?.controls.find((c) => c.id === 'dpi'),
        ).toMatchObject({ x: 4, y: 4 })
    })

    it('commits discrete edits and clears the redo stack', () => {
        store.getState().commit(moveControl(mouse, 'lmb', 1, 1))
        store.getState().undo()
        expect(store.getState().future).toHaveLength(1)
        store.getState().commit(moveControl(mouse, 'rmb', 5, 0))
        expect(store.getState().future).toHaveLength(0)
    })

    it('applies a fixed layout to the connected device and closes the builder', async () => {
        const apply = vi.fn(() => Promise.resolve())
        useConnectionStore.setState({
            service: { controls: { layout: { apply } } } as never,
        })
        useBuilderStore.setState({ open: true, docKind: 'device' })
        store.getState().start(mouse, 'device')
        await store.getState().applyToDevice()
        expect(apply).toHaveBeenCalledWith(mouse)
        expect(useBuilderStore.getState().open).toBe(false)
    })

    it('keeps the builder open when the layout does not fit', async () => {
        const apply = vi.fn(() => Promise.reject(new Error('missing')))
        useConnectionStore.setState({
            service: { controls: { layout: { apply } } } as never,
        })
        useBuilderStore.setState({ open: true })
        await store.getState().applyToDevice()
        expect(useBuilderStore.getState().open).toBe(true)
        expect(toast.error).toHaveBeenCalled()
    })
})
