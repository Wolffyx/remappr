// Pattern check: Dispatch Map (Tier 0) — applied — kind → {write, close, isOpen} table replaces the if/else chains on activeKind in send and close.
/**
 * The main process holds ONE device connection at a time, across every
 * transport kind (serial, BlueZ, node-hid). This router owns that rule:
 *
 * - Opening any transport first closes every transport that is open, whatever
 *   its kind, so mixing kinds can't leak a port or a link.
 * - Every connection gets a fresh id. Data and disconnect events carry it, and
 *   a send or close names it, so a late close or event from a connection that
 *   is already gone can't reach the one that replaced it.
 * - Opens and closes run one after another, in the order they arrive, so a
 *   close that is still awaiting its port can't land on the next connection.
 */
import { createLogger } from '../shared/logger'

const log = createLogger('transport')

export type TransportKind = 'serial' | 'bluez' | 'hid'

/** One transport's primitives, as the router drives them. */
export interface TransportRoute {
    write(data: Uint8Array): Promise<void>
    close(): Promise<void>
    isOpen(): boolean
}

/** Callbacks a transport's connect function wires to its device. */
export interface ConnectionCallbacks {
    onData(data: number[]): void
    onDisconnected(): void
}

/** Where the router pushes the active connection's events. */
export interface ConnectionEmitter {
    data(data: number[], connectionId: number): void
    disconnected(connectionId: number): void
}

export interface OpenedConnection<T> {
    connectionId: number
    result: T
}

export interface TransportRouter {
    open<T>(
        kind: TransportKind,
        connect: (callbacks: ConnectionCallbacks) => Promise<T>,
    ): Promise<OpenedConnection<T>>
    send(data: Uint8Array, connectionId?: number): Promise<void>
    close(connectionId?: number): Promise<void>
    activeKind(): TransportKind | null
}

interface ActiveConnection {
    kind: TransportKind
    id: number
}

export function createTransportRouter(
    routes: Record<TransportKind, TransportRoute>,
    emit: ConnectionEmitter,
): TransportRouter {
    let active: ActiveConnection | null = null
    let nextId = 0
    let queue: Promise<unknown> = Promise.resolve()

    // Run `fn` after every open/close queued before it.
    function serialize<T>(fn: () => Promise<T>): Promise<T> {
        const run = queue.then(fn, fn)
        queue = run.catch(() => undefined)
        return run
    }

    // The one close-any-transport step.
    async function closeAll(): Promise<void> {
        active = null
        for (const [kind, route] of Object.entries(routes)) {
            if (!route.isOpen()) continue
            await route.close().catch((err: unknown) => {
                log.warn(`closing ${kind} failed:`, err)
            })
        }
    }

    function callbacksFor(id: number): ConnectionCallbacks {
        return {
            onData: (data) => {
                if (active?.id === id) emit.data(data, id)
            },
            onDisconnected: () => {
                if (active?.id !== id) return
                active = null
                emit.disconnected(id)
            },
        }
    }

    const isStale = (connectionId: number | undefined): boolean =>
        connectionId !== undefined &&
        active !== null &&
        active.id !== connectionId

    return {
        open: (kind, connect) =>
            serialize(async () => {
                await closeAll()
                const id = ++nextId
                // Set before connect resolves: a BLE device can notify while
                // the connect is still finishing.
                active = { kind, id }
                try {
                    const result = await connect(callbacksFor(id))
                    return { connectionId: id, result }
                } catch (err) {
                    if (active?.id === id) active = null
                    throw err
                }
            }),

        async send(data, connectionId) {
            if (!active) throw new Error('No active device connection')
            if (isStale(connectionId)) {
                throw new Error('Device connection closed')
            }
            await routes[active.kind].write(data)
        },

        close: (connectionId) =>
            serialize(async () => {
                if (isStale(connectionId)) return
                await closeAll()
            }),

        activeKind: () => active?.kind ?? null,
    }
}
