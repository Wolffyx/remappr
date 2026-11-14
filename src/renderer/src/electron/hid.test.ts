// pattern-check: skip — unit test with window.api faked, no production logic
import { describe, expect, it, vi } from 'vitest'
import { IpcEvents } from '../../../shared/ipc-types'

const listeners = new Map<string, () => void>()
vi.stubGlobal('window', {
    api: {
        invoke: vi.fn(),
        on: (event: string, cb: () => void) => {
            listeners.set(event, cb)
            return () => listeners.delete(event)
        },
    },
})
vi.mock('../transport/adapter/discovery', () => ({
    bleDiscovery: () => null,
    hidDiscovery: () => ({ usagePage: 0xff00 }),
    hidDiscoveryAll: () => [{ usagePage: 0xff00 }],
    hidFilters: () => [],
}))

await import('./hid')
const { subscribeAllChanges } = await import('../transport/adapter/registry')

describe('Electron HID transport (L4.6)', () => {
    it('re-lists when the main process reports a HID hotplug', () => {
        const cb = vi.fn()
        const off = subscribeAllChanges('electron', cb)
        listeners.get(IpcEvents.HID_DEVICES_CHANGED)?.()
        expect(cb).toHaveBeenCalledTimes(1)
        off()
        expect(listeners.has(IpcEvents.HID_DEVICES_CHANGED)).toBe(false)
    })
})
