// pattern-check: skip — unit test, no production logic
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { KeyboardService } from '@firmware/service'
import { IpcChannels, IpcEvents } from '@shared/ipc-types'

vi.mock('sonner', () => ({ toast: { error: vi.fn(), warning: vi.fn() } }))

import { installWindowLeaveGuard } from './windowLeaveGuard'
import useConnectionStore from '@/stores/connectionStore'
import useLeaveGuardStore, {
    dismissLeavePrompt,
} from '@/stores/leaveGuardStore'
import { withSaveMode } from '@/lib/saveMode'

/* A device whose pending flag the test drives; Save / Discard clear it. */
function makeDevice(saveMode: 'manual' | 'none' = 'manual'): {
    service: KeyboardService
    setPending: (p: boolean) => void
} {
    let pending = false
    const listeners = new Set<(p: boolean) => void>()
    const setPending = (p: boolean): void => {
        pending = p
        for (const cb of listeners) cb(p)
    }
    const service = {
        deviceInfo: { name: 'Mouse', firmware: 'remappr' },
        capabilities: { lock: 'none', saveMode },
        listActionTypes: async () => [],
        disconnect: async () => undefined,
        commit: async () => setPending(false),
        discardChanges: async () => setPending(false),
        hasPendingChanges: () => pending,
        refreshPendingChanges: async () => pending,
        onPendingChangesChanged: (cb: (p: boolean) => void) => {
            listeners.add(cb)
            return () => listeners.delete(cb)
        },
    } as unknown as KeyboardService
    return { service, setPending }
}

/* The preload API as the guard sees it: invoke records, on keeps the handler. */
function makeApi(): {
    api: Parameters<typeof installWindowLeaveGuard>[0]
    invoke: ReturnType<typeof vi.fn>
    requestLeave: () => void
    sent: (channel: string) => unknown[]
} {
    const handlers = new Map<string, () => void>()
    const invoke = vi.fn<(channel: string, value?: unknown) => Promise<void>>(
        async () => undefined,
    )
    return {
        api: {
            invoke,
            on: (event, cb) => {
                handlers.set(event, cb as () => void)
                return () => handlers.delete(event)
            },
        },
        invoke,
        requestLeave: () => handlers.get(IpcEvents.WINDOW_LEAVE_REQUESTED)?.(),
        sent: (channel) =>
            invoke.mock.calls.filter((c) => c[0] === channel).map((c) => c[1]),
    }
}

const connect = (service: KeyboardService): void =>
    useConnectionStore.getState().setService(withSaveMode(service, false))

beforeEach(() => {
    dismissLeavePrompt()
    useConnectionStore.getState().resetConnection()
})

describe('installWindowLeaveGuard', () => {
    it('tells main whether the device holds unsaved edits, once per change', () => {
        const { api, sent } = makeApi()
        const off = installWindowLeaveGuard(api)
        const { service, setPending } = makeDevice()
        connect(service)

        setPending(true)
        setPending(true)
        setPending(false)

        expect(sent(IpcChannels.WINDOW_SET_UNSAVED)).toEqual([
            false,
            true,
            false,
        ])
        off()
    })

    it('never reports edits for a device with nothing to save', () => {
        const { api, sent } = makeApi()
        const off = installWindowLeaveGuard(api)
        const { service, setPending } = makeDevice('none')
        useConnectionStore.getState().setService(service)
        setPending(true)

        expect(sent(IpcChannels.WINDOW_SET_UNSAVED)).toEqual([false])
        off()
    })

    it('reports clean again when the device goes away', () => {
        const { api, sent } = makeApi()
        const off = installWindowLeaveGuard(api)
        const { service, setPending } = makeDevice()
        connect(service)
        setPending(true)

        useConnectionStore.getState().setService(null)

        expect(sent(IpcChannels.WINDOW_SET_UNSAVED)).toEqual([
            false,
            true,
            false,
        ])
        off()
    })

    it('answers a leave at once with nothing unsaved', async () => {
        const { api, requestLeave, sent } = makeApi()
        const off = installWindowLeaveGuard(api)
        connect(makeDevice().service)

        requestLeave()

        await vi.waitFor(() =>
            expect(sent(IpcChannels.WINDOW_LEAVE_DECIDED)).toEqual([true]),
        )
        off()
    })

    it('answers with the user choice from the prompt', async () => {
        const { api, requestLeave, sent } = makeApi()
        const off = installWindowLeaveGuard(api)
        const { service, setPending } = makeDevice()
        connect(service)
        setPending(true)

        requestLeave()
        await vi.waitFor(() =>
            expect(useLeaveGuardStore.getState().deviceName).toBe('Mouse'),
        )
        useLeaveGuardStore.getState().choose('cancel')
        await vi.waitFor(() =>
            expect(sent(IpcChannels.WINDOW_LEAVE_DECIDED)).toEqual([false]),
        )

        requestLeave()
        await vi.waitFor(() =>
            expect(useLeaveGuardStore.getState().deviceName).toBe('Mouse'),
        )
        useLeaveGuardStore.getState().choose('discard')
        await vi.waitFor(() =>
            expect(sent(IpcChannels.WINDOW_LEAVE_DECIDED)).toEqual([
                false,
                true,
            ]),
        )
        off()
    })

    it('stops listening after teardown', () => {
        const { api, sent } = makeApi()
        installWindowLeaveGuard(api)()
        const { service, setPending } = makeDevice()
        connect(service)
        setPending(true)

        expect(sent(IpcChannels.WINDOW_SET_UNSAVED)).toEqual([false])
    })
})
