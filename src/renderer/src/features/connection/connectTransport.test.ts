// pattern-check: skip — unit test, no production logic
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Transport } from '@firmware'
import type { KeyboardService } from '@firmware/service'

const adapter = vi.hoisted(() => ({ connect: vi.fn() }))
const pickAdapter = vi.hoisted(() => vi.fn())
vi.mock('@firmware', () => ({
    pickAdapter,
    UserCancelledError: class UserCancelledError extends Error {},
}))
vi.mock('@/transport/adapter/firmwareClients', () => ({
    ensureFirmwareClientsLoaded: async () => undefined,
}))
vi.mock('sonner', () => ({
    toast: { error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}))

import { connectTransport, switchToDevice } from './connectTransport'
import type { DeviceWithTransport } from './types'
import useConnectionStore from '@/stores/connectionStore'
import useLeaveGuardStore, {
    dismissLeavePrompt,
} from '@/stores/leaveGuardStore'
import { unwrapSaveMode, withSaveMode } from '@/lib/saveMode'

function makeService(
    name: string,
    pending = false,
): KeyboardService & { disconnect: ReturnType<typeof vi.fn> } {
    let p = pending
    return {
        deviceInfo: { name, firmware: 'remappr', firmwareVersion: '1.0.0' },
        capabilities: { lock: 'none', saveMode: 'manual' },
        listActionTypes: async () => [],
        disconnect: vi.fn(async () => undefined),
        commit: async () => {
            p = false
        },
        discardChanges: async () => {
            p = false
        },
        hasPendingChanges: () => p,
        refreshPendingChanges: async () => p,
        onPendingChangesChanged: () => () => undefined,
        onClosed: () => () => undefined,
        getLockState: async () => 'unlocked',
    } as unknown as KeyboardService & {
        disconnect: ReturnType<typeof vi.fn>
    }
}

/* A listed device whose transport hands back a fake rpc. */
function listed(id: string): {
    target: DeviceWithTransport
    pick: ReturnType<typeof vi.fn>
} {
    const pick = vi.fn(async () => ({ label: 'hid' }) as unknown as Transport)
    return {
        target: {
            device: { id, label: `Device ${id}` },
            transport: {
                label: 'USB',
                communication: 'hid',
                pick_and_connect: { list: async () => [], connect: pick },
            } as unknown as DeviceWithTransport['transport'],
            status: 'available',
        },
        pick,
    }
}

const connectCurrent = (service: KeyboardService): void =>
    useConnectionStore
        .getState()
        .setService(withSaveMode(service, false), 'hid')

const current = (): KeyboardService | null => {
    const s = useConnectionStore.getState().service
    return s ? unwrapSaveMode(s) : null
}

beforeEach(() => {
    dismissLeavePrompt()
    useConnectionStore.getState().resetConnection()
    pickAdapter.mockReset().mockReturnValue(adapter)
    adapter.connect.mockReset()
})

describe('connectTransport', () => {
    it('shows the device once the handshake succeeds', async () => {
        const next = makeService('Mouse')
        adapter.connect.mockResolvedValue(next)

        expect(await connectTransport({} as Transport, 'hid')).toBe(true)
        expect(current()).toBe(next)
        expect(useConnectionStore.getState().deviceName).toBe('Mouse')
    })

    it('reports false when no adapter takes the device', async () => {
        pickAdapter.mockReturnValue(null)
        expect(await connectTransport({} as Transport, 'hid')).toBe(false)
        expect(current()).toBeNull()
    })
})

describe('switchToDevice', () => {
    it('opens the new device, then closes the old one', async () => {
        const old = makeService('Old')
        connectCurrent(old)
        const next = makeService('Next')
        adapter.connect.mockResolvedValue(next)
        const { target, pick } = listed('next-id')

        expect(await switchToDevice(target)).toBe(true)

        expect(pick).toHaveBeenCalledTimes(1)
        expect(old.disconnect).toHaveBeenCalledTimes(1)
        expect(current()).toBe(next)
        expect(useConnectionStore.getState().lastConnectedDevice).toEqual({
            id: 'next-id',
            label: 'Device next-id',
        })
    })

    it('keeps the current device when the new one fails to open', async () => {
        const old = makeService('Old')
        connectCurrent(old)
        adapter.connect.mockRejectedValue(new Error('timeout'))

        expect(await switchToDevice(listed('next-id').target)).toBe(false)

        expect(old.disconnect).not.toHaveBeenCalled()
        expect(current()).toBe(old)
    })

    it('opens nothing when the user stays on a device with unsaved edits', async () => {
        const old = makeService('Old', true)
        connectCurrent(old)
        const { target, pick } = listed('next-id')

        const switching = switchToDevice(target)
        await vi.waitFor(() =>
            expect(useLeaveGuardStore.getState().deviceName).toBe('Old'),
        )
        useLeaveGuardStore.getState().choose('cancel')

        expect(await switching).toBe(false)
        expect(pick).not.toHaveBeenCalled()
        expect(current()).toBe(old)
    })

    it('switches after Discard', async () => {
        const old = makeService('Old', true)
        connectCurrent(old)
        const next = makeService('Next')
        adapter.connect.mockResolvedValue(next)

        const switching = switchToDevice(listed('next-id').target)
        await vi.waitFor(() =>
            expect(useLeaveGuardStore.getState().deviceName).toBe('Old'),
        )
        useLeaveGuardStore.getState().choose('discard')

        expect(await switching).toBe(true)
        expect(current()).toBe(next)
    })
})
