// pattern-check: skip — store unit test, no production logic
import { beforeEach, describe, expect, it, vi } from 'vitest'
import useConnectionStore from './connectionStore'
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
