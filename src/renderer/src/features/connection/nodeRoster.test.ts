// pattern-check: skip — assertions over the shared node roster and its helpers
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { NodesApi, NodeView } from '@firmware/service'

import {
    clusterCoordinator,
    NodeRoster,
    nodeKey,
    nodeRosterFor,
    notReachable,
} from './nodeRoster'

const node = (over: Partial<NodeView>): NodeView => ({
    id: 1,
    label: 'Keyboard 0x0001',
    personality: 1,
    online: true,
    secured: true,
    bonded: true,
    rssi: 0,
    hopCount: 0,
    isMaster: false,
    nodeRole: 0,
    ...over,
})

const fakeApi = (list: NodesApi['list']): NodesApi =>
    ({ list }) as unknown as NodesApi

const flush = async (): Promise<void> => {
    for (let i = 0; i < 5; i++) await Promise.resolve()
}

describe('NodeRoster', () => {
    beforeEach(() => {
        vi.useFakeTimers()
        vi.spyOn(console, 'warn').mockImplementation(() => {})
    })
    afterEach(() => {
        vi.useRealTimers()
        vi.restoreAllMocks()
    })

    // L4.10: one failed LIST_NODES (a busy relay) emptied the roster.
    it('keeps the last good list when a read fails', async () => {
        const good = [node({ id: 1 }), node({ id: 2 })]
        const list = vi
            .fn<NodesApi['list']>()
            .mockResolvedValueOnce(good)
            .mockRejectedValueOnce(new Error('relay busy'))
        const roster = new NodeRoster(fakeApi(list), 1000)

        await roster.refresh()
        await expect(roster.refresh()).rejects.toThrow('relay busy')

        expect(roster.getSnapshot().nodes).toEqual(good)
        expect(roster.getSnapshot().loading).toBe(false)
    })

    it('ends loading when the first read fails', async () => {
        const roster = new NodeRoster(
            fakeApi(() => Promise.reject(new Error('timeout'))),
            1000,
        )
        expect(roster.getSnapshot().loading).toBe(true)
        await expect(roster.refresh()).rejects.toThrow('timeout')
        expect(roster.getSnapshot()).toEqual({ nodes: [], loading: false })
    })

    it('polls while subscribed, once for every listener', async () => {
        const list = vi.fn<NodesApi['list']>().mockResolvedValue([node({})])
        const roster = new NodeRoster(fakeApi(list), 1000)

        const offA = roster.subscribe(() => {})
        const offB = roster.subscribe(() => {})
        await flush()
        expect(list).toHaveBeenCalledTimes(1)

        await vi.advanceTimersByTimeAsync(1000)
        expect(list).toHaveBeenCalledTimes(2)

        offA()
        await vi.advanceTimersByTimeAsync(1000)
        expect(list).toHaveBeenCalledTimes(3)

        offB()
        await vi.advanceTimersByTimeAsync(5000)
        expect(list).toHaveBeenCalledTimes(3)
    })

    it('a failed poll is logged, not thrown, and the list stays', async () => {
        const good = [node({ id: 7 })]
        const list = vi
            .fn<NodesApi['list']>()
            .mockResolvedValueOnce(good)
            .mockRejectedValue(new Error('relay busy'))
        const roster = new NodeRoster(fakeApi(list), 1000)
        const seen: number[] = []
        roster.subscribe(() => seen.push(roster.getSnapshot().nodes.length))

        await vi.advanceTimersByTimeAsync(3000)

        expect(list.mock.calls.length).toBeGreaterThan(1)
        expect(roster.getSnapshot().nodes).toEqual(good)
        expect(seen.every((n) => n === 1)).toBe(true)
        expect(console.warn).toHaveBeenCalled()
    })

    it('shares one read between calls made while it is in flight', async () => {
        let resolve: (v: NodeView[]) => void = () => {}
        const list = vi.fn<NodesApi['list']>(
            () =>
                new Promise((r) => {
                    resolve = r
                }),
        )
        const roster = new NodeRoster(fakeApi(list), 1000)

        const a = roster.refresh()
        const b = roster.refresh()
        resolve([node({})])
        await Promise.all([a, b])

        expect(list).toHaveBeenCalledTimes(1)
    })

    it('gives every view of one NodesApi the same roster', () => {
        const api = fakeApi(() => Promise.resolve([]))
        expect(nodeRosterFor(api)).toBe(nodeRosterFor(api))
        expect(nodeRosterFor(api)).not.toBe(
            nodeRosterFor(fakeApi(() => Promise.resolve([]))),
        )
    })
})

describe('clusterCoordinator', () => {
    // L4.7: older firmware reports every node as a main, so every node wore
    // the crown.
    it('badges no node when every node calls itself a main', () => {
        const nodes = [
            node({ id: 1, isMaster: true, clusterRole: 'standalone' }),
            node({ id: 2, isMaster: true, clusterRole: 'standalone' }),
        ]
        expect(clusterCoordinator(nodes)).toBeUndefined()
    })

    it('badges the coordinator of a cluster with a follower', () => {
        const nodes = [
            node({ id: 1, clusterRole: 'coordinator' }),
            node({ id: 2, clusterRole: 'follower' }),
            node({ id: 3, clusterRole: 'standalone' }), // a mouse
        ]
        expect(clusterCoordinator(nodes)).toBe(1)
    })

    it('badges no keyboard that works on its own', () => {
        expect(
            clusterCoordinator([node({ id: 1, clusterRole: 'coordinator' })]),
        ).toBeUndefined()
    })

    it('badges no node when two claim to coordinate', () => {
        const nodes = [
            node({ id: 1, clusterRole: 'coordinator' }),
            node({ id: 2, clusterRole: 'coordinator' }),
            node({ id: 3, clusterRole: 'follower' }),
        ]
        expect(clusterCoordinator(nodes)).toBeUndefined()
    })
})

describe('notReachable', () => {
    // L4.8: Open and Unpair were offered on any online node, but the dongle can
    // only seal control toward a node whose session is up.
    it('blocks an online node whose secure session is not up', () => {
        expect(notReachable(node({ online: true, secured: false }))).toMatch(
            /secure session/,
        )
    })

    it('blocks an offline node', () => {
        expect(notReachable(node({ online: false, secured: false }))).toMatch(
            /offline/,
        )
    })

    it('allows a secured node', () => {
        expect(notReachable(node({ online: true, secured: true }))).toBe(
            undefined,
        )
    })
})

describe('nodeKey', () => {
    it('keys by the device id when the node reports one', () => {
        expect(nodeKey({ id: 7, deviceId: 'a1b2c3d4e5f6' })).toBe(
            'dev:a1b2c3d4e5f6',
        )
    })

    it('falls back to the short id', () => {
        expect(nodeKey({ id: 7 })).toBe('id:7')
    })
})
