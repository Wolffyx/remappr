// Pattern check: Observer (Tier 1) — applied — one polled roster per NodesApi
// that the dongle landing and the sidebar both subscribe to
// (useSyncExternalStore), instead of two lists that drift.
//
// The nodes behind a dongle, listed once and re-listed while anything shows
// them. A failed LIST_NODES (a busy relay, a timeout) keeps the last good list:
// the nodes are still there, the read just did not come back this time.
import { useCallback, useSyncExternalStore } from 'react'
import type { NodesApi, NodeView } from '@firmware/service'

import { BATTERY_POLL_MS } from '@/features/battery/useDeviceBattery'

export interface NodeRosterState {
    readonly nodes: readonly NodeView[]
    /** No list has come back yet (the first read is in flight or failed). */
    readonly loading: boolean
}

const EMPTY: NodeRosterState = { nodes: [], loading: false }

export class NodeRoster {
    private state: NodeRosterState = { nodes: [], loading: true }
    private readonly listeners = new Set<() => void>()
    private inFlight: Promise<void> | null = null
    private timer: ReturnType<typeof setInterval> | null = null

    constructor(
        private readonly api: NodesApi,
        private readonly pollMs: number = BATTERY_POLL_MS,
    ) {}

    getSnapshot = (): NodeRosterState => this.state

    /** Listen for changes. The first listener starts the poll (and a read),
     *  the last one to leave stops it. */
    subscribe = (listener: () => void): (() => void) => {
        this.listeners.add(listener)
        if (this.listeners.size === 1) this.start()
        return (): void => {
            this.listeners.delete(listener)
            if (this.listeners.size === 0) this.stop()
        }
    }

    /** Re-list now. Rejects when the read fails; the list keeps its last good
     *  value either way. Calls made while a read is in flight share it. */
    refresh(): Promise<void> {
        this.inFlight ??= this.read().finally(() => {
            this.inFlight = null
        })
        return this.inFlight
    }

    private async read(): Promise<void> {
        try {
            this.set({ nodes: await this.api.list(), loading: false })
        } catch (e) {
            if (this.state.loading) this.set({ ...this.state, loading: false })
            throw e
        }
    }

    private poll(): void {
        this.refresh().catch((e: unknown) => {
            console.warn('Failed to list nodes', e)
        })
    }

    private start(): void {
        this.poll()
        this.timer = setInterval(() => this.poll(), this.pollMs)
    }

    private stop(): void {
        if (this.timer !== null) clearInterval(this.timer)
        this.timer = null
    }

    private set(next: NodeRosterState): void {
        this.state = next
        for (const l of this.listeners) l()
    }
}

const rosters = new WeakMap<NodesApi, NodeRoster>()

/** The one roster for `api`, made on first use. */
export function nodeRosterFor(api: NodesApi): NodeRoster {
    let roster = rosters.get(api)
    if (!roster) {
        roster = new NodeRoster(api)
        rosters.set(api, roster)
    }
    return roster
}

const noop = (): void => {}
const subscribeNone = (): (() => void) => noop
const snapshotNone = (): NodeRosterState => EMPTY

/** The polled roster of `api` (empty and idle without one), and a refresh
 *  that rejects when the read fails. */
export function useNodeRoster(api: NodesApi | undefined): NodeRosterState & {
    refresh: () => Promise<void>
} {
    const roster = api ? nodeRosterFor(api) : null
    const state = useSyncExternalStore(
        roster ? roster.subscribe : subscribeNone,
        roster ? roster.getSnapshot : snapshotNone,
    )
    const refresh = useCallback(
        (): Promise<void> => (roster ? roster.refresh() : Promise.resolve()),
        [roster],
    )
    return { ...state, refresh }
}

/**
 * The node to badge as the coordinator: the one coordinator of a cluster that
 * has a follower in this roster. A keyboard on its own reports itself as a
 * coordinator too (and older firmware calls every node a main), so with no
 * follower, or with more than one coordinator, no node is badged.
 */
export function clusterCoordinator(
    nodes: readonly NodeView[],
): number | undefined {
    if (!nodes.some((n) => n.clusterRole === 'follower')) return undefined
    const coordinators = nodes.filter((n) => n.clusterRole === 'coordinator')
    return coordinators.length === 1 ? coordinators[0].id : undefined
}

/** A key for per-node state that survives a re-pair: the device-reported id,
 *  else the relay short-id. */
export function nodeKey(n: Pick<NodeView, 'id' | 'deviceId'>): string {
    return n.deviceId ? `dev:${n.deviceId}` : `id:${n.id}`
}

/** Why a node cannot be opened or unpaired right now; undefined when it can. */
export function notReachable(n: NodeView): string | undefined {
    if (!n.online) return 'The node is offline'
    if (!n.secured)
        return 'The node is online, but its secure session is not up yet'
    return undefined
}
