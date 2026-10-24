// pattern-check: skip — store unit test, no production logic
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { KeyboardService, NodeView } from '@firmware/service'

const toast = vi.hoisted(() => ({ error: vi.fn(), warning: vi.fn() }))
vi.mock('sonner', () => ({ toast }))

import useConnectionStore from './connectionStore'
import useLeaveGuardStore, {
    confirmLeave,
    dismissLeavePrompt,
    unloadGuard,
} from './leaveGuardStore'
import useUndoRedoStore from './undoRedoStore'
import useUserSettingsStore from './userSettingsStore'
import { withSaveMode } from '@/lib/saveMode'
import { openService } from '@/features/connection/openService'

type SaveMode = 'manual' | 'automatic' | 'none'

/* A device that stages edits (a Remappr mouse, a ZMK board): its pending flag
 * drops when a save or a discard lands. */
function makeDevice(
    name: string,
    opts: { pending?: boolean; saveMode?: SaveMode; readOnly?: boolean } = {},
): {
    service: KeyboardService
    commit: ReturnType<typeof vi.fn>
    discardChanges: ReturnType<typeof vi.fn>
    disconnect: ReturnType<typeof vi.fn>
} {
    let pending = opts.pending ?? false
    const listeners = new Set<(p: boolean) => void>()
    const setPending = (p: boolean): void => {
        pending = p
        for (const cb of listeners) cb(p)
    }
    const commit = vi.fn(async () => setPending(false))
    const discardChanges = vi.fn(async () => setPending(false))
    const disconnect = vi.fn(async () => undefined)
    const service = {
        deviceInfo: { name, firmware: 'remappr', firmwareVersion: '1.0.0' },
        capabilities: {
            lock: 'none',
            saveMode: opts.saveMode ?? 'manual',
            readOnly: opts.readOnly,
        },
        listActionTypes: async () => [],
        disconnect,
        commit,
        discardChanges,
        hasPendingChanges: () => pending,
        refreshPendingChanges: async () => pending,
        onPendingChangesChanged: (cb: (p: boolean) => void) => {
            listeners.add(cb)
            return () => listeners.delete(cb)
        },
    } as unknown as KeyboardService
    return { service, commit, discardChanges, disconnect }
}

/* Connect `service` the way the app does: wrapped in the save-mode controller. */
function connect(service: KeyboardService): KeyboardService {
    const live = withSaveMode(service, useUserSettingsStore.getState().autosave)
    useConnectionStore.getState().setService(live, 'hid')
    return live
}

const NODE: NodeView = {
    id: 0x0002,
    label: 'Mouse 0x0002',
    personality: 2,
    online: true,
    bonded: true,
    rssi: -40,
    hopCount: 0,
    isMaster: true,
    nodeRole: 0x01,
}

/* A dongle whose roster opens editable nodes made by `node(id)`. */
function makeDongle(node: (id: number) => KeyboardService): {
    service: KeyboardService
    disconnect: ReturnType<typeof vi.fn>
} {
    const { service, disconnect } = makeDevice('Remappr Dongle')
    Object.assign(service, {
        nodes: {
            list: async () => [NODE],
            open: async (id: number) => node(id),
        },
    })
    return { service, disconnect }
}

const promptOpen = (): Promise<void> =>
    vi.waitFor(() =>
        expect(useLeaveGuardStore.getState().deviceName).not.toBeNull(),
    )
const choose = (c: 'save' | 'discard' | 'cancel'): void =>
    useLeaveGuardStore.getState().choose(c)

beforeEach(() => {
    dismissLeavePrompt()
    useConnectionStore.getState().resetConnection()
    useUserSettingsStore.getState().setAutosave(false)
    toast.error.mockClear()
    toast.warning.mockClear()
})

describe('confirmLeave', () => {
    it('lets a device with nothing unsaved go without asking', async () => {
        const { service } = makeDevice('Mouse')
        expect(await confirmLeave(withSaveMode(service, false))).toBe(true)
        expect(useLeaveGuardStore.getState().deviceName).toBeNull()
    })

    it('never asks for a device with nothing to save (demo, read-only)', async () => {
        const demo = makeDevice('Demo', { pending: true, saveMode: 'none' })
        const ro = makeDevice('Node', { pending: true, readOnly: true })
        expect(await confirmLeave(withSaveMode(demo.service, false))).toBe(true)
        expect(await confirmLeave(withSaveMode(ro.service, false))).toBe(true)
        expect(await confirmLeave(null)).toBe(true)
    })

    it('with Auto-save on, saves the pending edits on the way out', async () => {
        const { service, commit } = makeDevice('ZMK', { pending: true })
        expect(await confirmLeave(withSaveMode(service, true))).toBe(true)
        expect(commit).toHaveBeenCalledTimes(1)
        expect(useLeaveGuardStore.getState().deviceName).toBeNull()
    })

    it('asks when that Auto-save fails', async () => {
        const { service, commit } = makeDevice('ZMK', { pending: true })
        commit.mockRejectedValueOnce(new Error('link down'))
        const leave = confirmLeave(withSaveMode(service, true))
        await promptOpen()
        choose('cancel')
        expect(await leave).toBe(false)
    })

    it('shares one prompt between callers for the same device', async () => {
        const { service } = makeDevice('Mouse', { pending: true })
        const live = withSaveMode(service, false)
        const a = confirmLeave(live)
        await promptOpen()
        const b = confirmLeave(live)
        choose('discard')
        expect(await a).toBe(true)
        expect(await b).toBe(true)
    })

    it('keeps the prompt open when Save fails, then leaves on Discard', async () => {
        const { service, commit, discardChanges } = makeDevice('Mouse', {
            pending: true,
        })
        commit.mockRejectedValueOnce(new Error('COMMIT_CONFIG failed'))
        const leave = confirmLeave(withSaveMode(service, false))
        await promptOpen()
        choose('save')
        await vi.waitFor(() => expect(toast.error).toHaveBeenCalled())
        expect(toast.error).toHaveBeenCalledWith('COMMIT_CONFIG failed')
        expect(useLeaveGuardStore.getState().deviceName).toBe('Mouse')
        expect(useLeaveGuardStore.getState().busy).toBeNull()
        choose('discard')
        expect(await leave).toBe(true)
        expect(discardChanges).toHaveBeenCalledTimes(1)
    })

    it('leaves on Discard even when the device cannot discard', async () => {
        const { service, discardChanges } = makeDevice('Mouse', {
            pending: true,
        })
        discardChanges.mockRejectedValueOnce(new Error('timeout'))
        const leave = confirmLeave(withSaveMode(service, false))
        await promptOpen()
        choose('discard')
        expect(await leave).toBe(true)
        expect(toast.warning).toHaveBeenCalled()
    })
})

describe('disconnect', () => {
    it('closes a device with nothing unsaved at once', async () => {
        const { service, disconnect } = makeDevice('Mouse')
        connect(service)
        expect(await useConnectionStore.getState().disconnect()).toBe(true)
        expect(disconnect).toHaveBeenCalledTimes(1)
        expect(useConnectionStore.getState().service).toBeNull()
    })

    it('stays on Cancel', async () => {
        const { service, disconnect } = makeDevice('Mouse', { pending: true })
        const live = connect(service)
        const left = useConnectionStore.getState().disconnect()
        await promptOpen()
        expect(useLeaveGuardStore.getState().deviceName).toBe('Mouse')
        choose('cancel')
        expect(await left).toBe(false)
        expect(disconnect).not.toHaveBeenCalled()
        expect(useConnectionStore.getState().service).toBe(live)
    })

    it('saves, then closes, on Save', async () => {
        const { service, commit, disconnect } = makeDevice('Mouse', {
            pending: true,
        })
        connect(service)
        const left = useConnectionStore.getState().disconnect()
        await promptOpen()
        choose('save')
        expect(await left).toBe(true)
        expect(commit).toHaveBeenCalledTimes(1)
        expect(disconnect).toHaveBeenCalledTimes(1)
        expect(useConnectionStore.getState().service).toBeNull()
    })

    it('discards, then closes, on Discard', async () => {
        const { service, discardChanges, disconnect } = makeDevice('Mouse', {
            pending: true,
        })
        connect(service)
        const left = useConnectionStore.getState().disconnect()
        await promptOpen()
        choose('discard')
        expect(await left).toBe(true)
        expect(discardChanges).toHaveBeenCalledTimes(1)
        expect(disconnect).toHaveBeenCalledTimes(1)
    })

    it('goes ahead when the device drops while the prompt is open', async () => {
        const { service } = makeDevice('Mouse', { pending: true })
        connect(service)
        const left = useConnectionStore.getState().disconnect()
        await promptOpen()
        useConnectionStore.getState().setService(null) // the transport closed
        expect(await left).toBe(true)
        expect(useLeaveGuardStore.getState().deviceName).toBeNull()
    })
})

describe('node views', () => {
    it('returnToParent asks, and stays on the node on Cancel', async () => {
        const node = makeDevice('Mouse 0x0002', { pending: true })
        const { service: dongle } = makeDongle(() => node.service)
        connect(dongle)
        await useConnectionStore.getState().openNode(0x0002)
        const nodeView = useConnectionStore.getState().service

        const back = useConnectionStore.getState().returnToParent()
        await promptOpen()
        choose('cancel')
        await back

        const s = useConnectionStore.getState()
        expect(s.service).toBe(nodeView)
        expect(s.activeNodeId).toBe(0x0002)
    })

    it('returnToParent goes back to the dongle on Discard', async () => {
        const node = makeDevice('Mouse 0x0002', { pending: true })
        const { service: dongle } = makeDongle(() => node.service)
        const liveDongle = connect(dongle)
        await useConnectionStore.getState().openNode(0x0002)

        const back = useConnectionStore.getState().returnToParent()
        await promptOpen()
        choose('discard')
        await back

        expect(node.discardChanges).toHaveBeenCalledTimes(1)
        expect(useConnectionStore.getState().service).toBe(liveDongle)
        expect(useConnectionStore.getState().activeNodeId).toBeNull()
    })

    it('returnToParent goes back at once with nothing unsaved', async () => {
        const node = makeDevice('Mouse 0x0002')
        const { service: dongle } = makeDongle(() => node.service)
        const liveDongle = connect(dongle)
        await useConnectionStore.getState().openNode(0x0002)

        await useConnectionStore.getState().returnToParent()

        expect(useLeaveGuardStore.getState().deviceName).toBeNull()
        expect(useConnectionStore.getState().service).toBe(liveDongle)
    })

    it('opening another node asks first, and stays on Cancel', async () => {
        const nodes = new Map<number, ReturnType<typeof makeDevice>>()
        const { service: dongle } = makeDongle((id) => {
            const d = makeDevice(`Node ${id}`, { pending: id === 0x0002 })
            nodes.set(id, d)
            return d.service
        })
        connect(dongle)
        await useConnectionStore.getState().openNode(0x0002)
        const first = useConnectionStore.getState().service

        const next = useConnectionStore.getState().openNode(0x0003)
        await promptOpen()
        choose('cancel')
        await next

        expect(useConnectionStore.getState().service).toBe(first)
        expect(nodes.has(0x0003)).toBe(false)
    })

    it('opening another node saves the current one on Save', async () => {
        const nodes = new Map<number, ReturnType<typeof makeDevice>>()
        const { service: dongle } = makeDongle((id) => {
            const d = makeDevice(`Node ${id}`, { pending: id === 0x0002 })
            nodes.set(id, d)
            return d.service
        })
        connect(dongle)
        await useConnectionStore.getState().openNode(0x0002)

        const next = useConnectionStore.getState().openNode(0x0003)
        await promptOpen()
        choose('save')
        await next

        expect(nodes.get(0x0002)!.commit).toHaveBeenCalledTimes(1)
        expect(useConnectionStore.getState().activeNodeId).toBe(0x0003)
    })

    it('opening a node from the dongle asks when the dongle holds edits', async () => {
        const node = makeDevice('Mouse 0x0002')
        const { service: dongle } = makeDongle(() => node.service)
        Object.assign(dongle, { hasPendingChanges: () => true })
        const liveDongle = connect(dongle)

        const open = useConnectionStore.getState().openNode(0x0002)
        await promptOpen()
        expect(useLeaveGuardStore.getState().deviceName).toBe('Remappr Dongle')
        choose('cancel')
        await open

        expect(useConnectionStore.getState().service).toBe(liveDongle)
    })
})

describe('openService (switching to another device)', () => {
    it('opens nothing when the user stays on the current device', async () => {
        const { service, disconnect } = makeDevice('Mouse', { pending: true })
        connect(service)
        const open = vi.fn(async () => makeDevice('Demo').service)

        const switching = openService(open)
        await promptOpen()
        choose('cancel')
        await switching

        expect(open).not.toHaveBeenCalled()
        expect(disconnect).not.toHaveBeenCalled()
    })

    it('closes the current device and opens the next on Discard', async () => {
        const { service, disconnect } = makeDevice('Mouse', { pending: true })
        connect(service)
        const next = makeDevice('Demo', { saveMode: 'none' }).service
        Object.assign(next, { onClosed: () => () => undefined })
        Object.assign(next, { getLockState: async () => 'unlocked' })
        const open = vi.fn(async () => next)

        const switching = openService(open)
        await promptOpen()
        choose('discard')
        await switching

        expect(disconnect).toHaveBeenCalledTimes(1)
        expect(open).toHaveBeenCalledTimes(1)
        expect(useConnectionStore.getState().service).toBe(next)
    })

    it('keeps the device left on screen until the next one replaces it', async () => {
        const { service, disconnect } = makeDevice('Keyboard')
        const live = connect(service)
        // The device reports its own close as it disconnects (ZMK does).
        disconnect.mockImplementation(async () =>
            useConnectionStore.getState().serviceClosed(live),
        )
        const next = makeDevice('Demo', { saveMode: 'none' }).service
        Object.assign(next, { onClosed: () => () => undefined })
        Object.assign(next, { getLockState: async () => 'unlocked' })
        let finishOpen!: (s: KeyboardService) => void
        const opening = new Promise<KeyboardService>((r) => {
            finishOpen = r
        })

        const switching = openService(() => opening)
        await vi.waitFor(() => expect(disconnect).toHaveBeenCalled())
        // Mid-switch: no empty connection, so no start page.
        expect(useConnectionStore.getState().service).toBe(live)
        finishOpen(next)
        await switching

        expect(useConnectionStore.getState().service).toBe(next)
        expect(useConnectionStore.getState().lockState).toBe('unlocked')
    })

    it('a device that closes on its own still clears the connection', () => {
        const { service } = makeDevice('Keyboard')
        const live = connect(service)
        useConnectionStore.getState().serviceClosed(live)
        expect(useConnectionStore.getState().service).toBeNull()
    })
})

describe('unloadGuard (closing or reloading the window)', () => {
    const fire = (service: KeyboardService | null): boolean => {
        const preventDefault = vi.fn()
        unloadGuard(() => service)({ preventDefault })
        return preventDefault.mock.calls.length > 0
    }

    it('holds the window while a device holds unsaved edits', () => {
        const { service } = makeDevice('Mouse', { pending: true })
        expect(fire(withSaveMode(service, false))).toBe(true)
    })

    it('lets it go with nothing unsaved, no device, or nothing to save', () => {
        const clean = makeDevice('Mouse')
        const demo = makeDevice('Demo', { pending: true, saveMode: 'none' })
        expect(fire(withSaveMode(clean.service, false))).toBe(false)
        expect(fire(withSaveMode(demo.service, false))).toBe(false)
        expect(fire(null)).toBe(false)
    })
})

describe('edit history across a node swap', () => {
    const pushEdit = (): Promise<void> =>
        useUndoRedoStore.getState().doIt(async () => async () => undefined)

    beforeEach(() => useUndoRedoStore.getState().reset())

    it('starts a fresh history on the next node and back on the dongle', async () => {
        const node = makeDevice('Mouse 0x0002')
        const { service: dongle } = makeDongle(() => node.service)
        connect(dongle)
        await pushEdit()

        await useConnectionStore.getState().openNode(0x0002)
        expect(useUndoRedoStore.getState().undoStack).toHaveLength(0)

        await pushEdit()
        await useConnectionStore.getState().returnToParent()
        expect(useUndoRedoStore.getState().undoStack).toHaveLength(0)
    })

    it('keeps the history when the user stays on the node', async () => {
        const node = makeDevice('Mouse 0x0002', { pending: true })
        const { service: dongle } = makeDongle(() => node.service)
        connect(dongle)
        await useConnectionStore.getState().openNode(0x0002)
        await pushEdit()

        const back = useConnectionStore.getState().returnToParent()
        await promptOpen()
        choose('cancel')
        await back

        expect(useUndoRedoStore.getState().undoStack).toHaveLength(1)
    })
})
