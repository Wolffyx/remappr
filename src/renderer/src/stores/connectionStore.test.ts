// pattern-check: skip — store unit test, no production logic
import { beforeEach, describe, expect, it, vi } from 'vitest'
import useConnectionStore from './connectionStore'
import useConfigStore from './configStore'
import useLayerSelectionStore from './layerSelectionStore'
import type { KeyboardService, NodeView } from '@firmware/service'

/* A behind-dongle node view: read-only, shares the dongle RPC, so its own
 * disconnect is a no-op on the transport (tracked here to prove the store
 * tears the dongle down on full disconnect). */
function makeNodeView(id: number): KeyboardService {
    const disconnect = vi.fn(async () => undefined)
    return {
        deviceInfo: {
            name: `Remappr Node 0x${id.toString(16).padStart(4, '0')}`,
            firmware: 'remappr',
            firmwareVersion: '1.2.3',
            vid: 0,
            pid: 0,
        },
        capabilities: {
            lock: false,
            rename: false,
            notifications: false,
            reorderLayers: false,
            variableLayerCount: false,
            exportFormats: [],
            readOnly: true,
        },
        listActionTypes: async () => [],
        disconnect,
        // nodes intentionally absent — a node has no nodes of its own.
    } as unknown as KeyboardService
}

/* The dongle service: owns the roster + relayed open(), and a real transport
 * (disconnect tears it down). */
function makeDongle(roster: NodeView[]): {
    service: KeyboardService
    views: Map<number, KeyboardService>
    disconnect: ReturnType<typeof vi.fn>
} {
    const views = new Map<number, KeyboardService>()
    const disconnect = vi.fn(async () => undefined)
    const service = {
        deviceInfo: {
            name: 'Remappr Dongle',
            firmware: 'remappr',
            firmwareVersion: '1.0.0',
            vid: 0x1234,
            pid: 0x5678,
        },
        capabilities: {
            lock: false,
            rename: true,
            notifications: false,
            reorderLayers: true,
            variableLayerCount: true,
            exportFormats: [],
        },
        listActionTypes: async () => [],
        disconnect,
        nodes: {
            list: async () => roster,
            open: async (id: number) => {
                const view = makeNodeView(id)
                views.set(id, view)
                return view
            },
        },
    } as unknown as KeyboardService
    return { service, views, disconnect }
}

const ROSTER: NodeView[] = [
    {
        id: 0x0007,
        label: 'Node 0x0007',
        personality: 2,
        online: true,
        bonded: true,
        rssi: -40,
        hopCount: 0,
        isMaster: true,
        nodeRole: 0x01,
    },
    {
        id: 0x0009,
        label: 'Node 0x0009',
        personality: 4,
        online: false,
        bonded: true,
        rssi: -72,
        hopCount: 1,
        isMaster: false,
        nodeRole: 0,
    },
]

describe('connectionStore node views', () => {
    beforeEach(() => {
        useConnectionStore.getState().resetConnection()
    })

    it('openNode swaps to the node view and stashes the dongle', async () => {
        const { service: dongle } = makeDongle(ROSTER)
        useConnectionStore.getState().setService(dongle, 'ble')

        await useConnectionStore.getState().openNode(0x0007)

        const s = useConnectionStore.getState()
        expect(s.parentService).toBe(dongle)
        expect(s.activeNodeId).toBe(0x0007)
        expect(s.service?.capabilities.readOnly).toBe(true)
        expect(s.service?.deviceInfo.name).toBe('Remappr Node 0x0007')
        expect(s.deviceName).toBe('Remappr Node 0x0007')
        // communication is carried over so the chip still shows BLE/USB.
        expect(s.communication).toBe('ble')
    })

    it('openNode is a no-op on a direct (non-dongle) device', async () => {
        const directService = {
            deviceInfo: { name: 'Plain KB', firmware: 'zmk' },
            capabilities: { lock: false },
            listActionTypes: async () => [],
            disconnect: async () => undefined,
            // no `nodes` facade
        } as unknown as KeyboardService
        useConnectionStore.getState().setService(directService)

        await useConnectionStore.getState().openNode(0x0007)

        const s = useConnectionStore.getState()
        expect(s.service).toBe(directService)
        expect(s.parentService).toBeNull()
        expect(s.activeNodeId).toBeNull()
    })

    it('returnToParent restores the dongle service', async () => {
        const { service: dongle } = makeDongle(ROSTER)
        useConnectionStore.getState().setService(dongle, 'ble')
        await useConnectionStore.getState().openNode(0x0007)

        useConnectionStore.getState().returnToParent()

        const s = useConnectionStore.getState()
        expect(s.service).toBe(dongle)
        expect(s.parentService).toBeNull()
        expect(s.activeNodeId).toBeNull()
        expect(s.deviceName).toBe('Remappr Dongle')
    })

    it('switches directly between two nodes, keeping the same dongle parent', async () => {
        const { service: dongle } = makeDongle(ROSTER)
        useConnectionStore.getState().setService(dongle, 'ble')

        await useConnectionStore.getState().openNode(0x0007)
        await useConnectionStore.getState().openNode(0x0009)

        const s = useConnectionStore.getState()
        expect(s.parentService).toBe(dongle)
        expect(s.activeNodeId).toBe(0x0009)
        expect(s.service?.deviceInfo.name).toBe('Remappr Node 0x0009')
    })

    it('disconnect from a node view tears down both the node and the dongle', async () => {
        const {
            service: dongle,
            views,
            disconnect: dongleDisc,
        } = makeDongle(ROSTER)
        useConnectionStore.getState().setService(dongle, 'ble')
        await useConnectionStore.getState().openNode(0x0007)
        const nodeView = views.get(0x0007)!

        await useConnectionStore.getState().disconnect()

        expect(nodeView.disconnect).toHaveBeenCalledTimes(1)
        expect(dongleDisc).toHaveBeenCalledTimes(1)
        const s = useConnectionStore.getState()
        expect(s.service).toBeNull()
        expect(s.parentService).toBeNull()
        expect(s.activeNodeId).toBeNull()
    })

    it('setService(null) clears the node back-pointer (dropped-transport guard)', async () => {
        const { service: dongle } = makeDongle(ROSTER)
        useConnectionStore.getState().setService(dongle, 'ble')
        await useConnectionStore.getState().openNode(0x0007)

        // Simulates the dongle onClosed handler firing setService(null).
        useConnectionStore.getState().setService(null)

        const s = useConnectionStore.getState()
        expect(s.parentService).toBeNull()
        expect(s.activeNodeId).toBeNull()
    })
})

/* A minimal valid v2 keymap whose single layer name is the distinguishing value —
 * lets the re-seed tests tell one committed blob from the next. */
const KM = (layerName: string): string =>
    JSON.stringify({
        version: 2,
        kind: 'remappr.keymap',
        meta: { name: 'Cfg' },
        keyboard: { id: 'x', name: 'Cfg', keys: [{ x: 0, y: 0 }] },
        layers: [{ name: layerName, keys: ['A'] }],
    })

/* A service that ships a config source (like remappr) and lets the test drive its
 * committed truth + the pending-changes edge, standing in for a real commit. */
function makeConfigService(initial: string): {
    service: KeyboardService
    setCommitted: (src: string) => void
    firePending: (pending: boolean) => void
    unsub: ReturnType<typeof vi.fn>
} {
    let committed = initial
    let cb: ((pending: boolean) => void) | null = null
    const unsub = vi.fn(() => {
        cb = null
    })
    const service = {
        deviceInfo: {
            name: 'Cfg KB',
            firmware: 'remappr',
            firmwareVersion: '1.0.0',
        },
        capabilities: { lock: false },
        listActionTypes: async () => [],
        disconnect: async () => undefined,
        getConfigSource: async () => committed,
        onPendingChangesChanged: (fn: (pending: boolean) => void) => {
            cb = fn
            return unsub
        },
    } as unknown as KeyboardService
    return {
        service,
        setCommitted: (src) => {
            committed = src
        },
        firePending: (pending) => cb?.(pending),
        unsub,
    }
}

const currentLayerName = (): string | undefined =>
    useConfigStore.getState().config?.layers?.[0]?.name

describe('connectionStore config re-seed', () => {
    beforeEach(() => {
        useConnectionStore.getState().resetConnection()
    })

    it('seeds config on connect; the commit (pending → false) edge only marks it stale', async () => {
        const h = makeConfigService(KM('base'))
        useConnectionStore.getState().setService(h.service)
        await vi.waitFor(() => expect(currentLayerName()).toBe('base'))
        expect(useConfigStore.getState().stale).toBe(false)

        // A commit advances committed truth then flips pending false. The edge
        // must NOT trigger a device read (that stalled the next edit behind the
        // serialized RPC channel) — it only marks the config stale.
        h.setCommitted(KM('raise'))
        h.firePending(false)
        await Promise.resolve()
        expect(currentLayerName()).toBe('base')
        expect(useConfigStore.getState().stale).toBe(true)
    })

    it('reseedConfigIfStale pulls the committed blob on demand, then clears stale', async () => {
        const h = makeConfigService(KM('base'))
        useConnectionStore.getState().setService(h.service)
        await vi.waitFor(() => expect(currentLayerName()).toBe('base'))

        h.setCommitted(KM('raise'))
        h.firePending(false)
        useConnectionStore.getState().reseedConfigIfStale()
        await vi.waitFor(() => expect(currentLayerName()).toBe('raise'))
        expect(useConfigStore.getState().stale).toBe(false)
    })

    it('reseedConfigIfStale is a no-op while fresh', async () => {
        const h = makeConfigService(KM('base'))
        useConnectionStore.getState().setService(h.service)
        await vi.waitFor(() => expect(currentLayerName()).toBe('base'))

        h.setCommitted(KM('raise')) // no pending edge → not stale
        useConnectionStore.getState().reseedConfigIfStale()
        await Promise.resolve()
        expect(currentLayerName()).toBe('base')
    })

    it('ignores the pending → true edge (mid-edit, committed truth unchanged)', async () => {
        const h = makeConfigService(KM('base'))
        useConnectionStore.getState().setService(h.service)
        await vi.waitFor(() => expect(currentLayerName()).toBe('base'))

        h.setCommitted(KM('raise'))
        h.firePending(true) // an edit began; nothing pushed yet
        await Promise.resolve()
        expect(currentLayerName()).toBe('base')
        expect(useConfigStore.getState().stale).toBe(false)
    })

    it('unsubscribes the stale-marking on disconnect; a late edge cannot resurrect config', async () => {
        const h = makeConfigService(KM('base'))
        useConnectionStore.getState().setService(h.service)
        await vi.waitFor(() => expect(currentLayerName()).toBe('base'))

        useConnectionStore.getState().resetConnection()
        expect(h.unsub).toHaveBeenCalledTimes(1)
        expect(useConfigStore.getState().config).toBeNull()

        h.setCommitted(KM('raise'))
        h.firePending(false)
        useConnectionStore.getState().reseedConfigIfStale()
        await Promise.resolve()
        expect(useConfigStore.getState().config).toBeNull()
    })
})

describe('connectionStore hardware default layer', () => {
    function makeLayerService(initial: number): {
        service: KeyboardService
        push: (layer: number) => void
    } {
        const listeners = new Set<(n: number) => void>()
        const service = {
            deviceInfo: {
                name: 'Keychron K5',
                firmware: 'keychron-qmk',
                firmwareVersion: 'kc-1',
                vid: 0x3434,
                pid: 0x0100,
            },
            capabilities: {
                lock: false,
                rename: false,
                notifications: true,
                reorderLayers: false,
                variableLayerCount: false,
                exportFormats: [],
            },
            listActionTypes: async () => [],
            disconnect: vi.fn(async () => undefined),
            layerControl: {
                getDefaultLayer: async () => initial,
                onDefaultLayerChanged: (cb: (n: number) => void) => {
                    listeners.add(cb)
                    return () => listeners.delete(cb)
                },
            },
        } as unknown as KeyboardService
        return {
            service,
            push: (layer: number) => {
                for (const cb of listeners) cb(layer)
            },
        }
    }

    const selected = (): number =>
        useLayerSelectionStore.getState().selectedLayerIndex

    beforeEach(() => {
        useConnectionStore.getState().resetConnection()
        useLayerSelectionStore.getState().setSelectedLayerIndex(0)
    })

    it('selects the hardware default layer on connect', async () => {
        const h = makeLayerService(2)
        useConnectionStore.getState().setService(h.service)
        await vi.waitFor(() => expect(selected()).toBe(2))
    })

    it('keeps the user selection when the board re-pushes the same layer', async () => {
        const h = makeLayerService(2)
        useConnectionStore.getState().setService(h.service)
        await vi.waitFor(() => expect(selected()).toBe(2))

        useLayerSelectionStore.getState().setSelectedLayerIndex(1)
        h.push(2)
        h.push(2)
        expect(selected()).toBe(1)
    })

    it('follows a genuine hardware layer change (Mac/Win switch)', async () => {
        const h = makeLayerService(2)
        useConnectionStore.getState().setService(h.service)
        await vi.waitFor(() => expect(selected()).toBe(2))

        useLayerSelectionStore.getState().setSelectedLayerIndex(1)
        h.push(0)
        expect(selected()).toBe(0)
    })
})
