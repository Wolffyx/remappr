// Pattern check: Template Method (Tier 1) — applied — connect() owns lifecycle, defers connectIpc() to subclasses; PlatformIpc is Strategy
import type { Transport } from '@firmware'
import { IpcChannels, IpcEvents } from '../../../../shared/ipc-types'
import { TransportAdapter } from './base'

export type Unlisten = () => void

/**
 * Per-platform IPC primitives. Strategy injected into
 * {@link IpcTransportAdapter}. `onConnectionData` / `onConnectionDisconnected`
 * always return `Promise<Unlisten>` so a sync (Electron) or async subscription
 * source can share one signature.
 */
export interface PlatformIpc {
    sendData(data: Uint8Array, connectionId?: number): Promise<void>

    close(connectionId?: number): Promise<void>

    onConnectionData(
        cb: (bytes: Uint8Array, connectionId?: number) => void,
    ): Promise<Unlisten>

    onConnectionDisconnected(
        cb: (connectionId?: number) => void,
    ): Promise<Unlisten>
}

export interface IpcConnectResult {
    /** Display name from the device, falls back to the dev.label passed to the adapter. */
    label?: string
    /** The main process's id for this connection. Events for any other id
     *  belong to another connection and are ignored; sends and the close
     *  name it, so they can't reach a connection that replaced this one. */
    connectionId?: number
}

/**
 * Concrete connect() lifecycle: invoke platform IPC to open the connection,
 * wire the response stream + abort handling, return a {@link Transport}.
 * Subclasses only override `connectIpc()` to issue the per-transport invoke.
 */
export abstract class IpcTransportAdapter extends TransportAdapter {
    constructor(
        protected readonly platform: PlatformIpc,
        defaultLabel: string,
    ) {
        super()
        this.label = defaultLabel
    }

    /** Issue the platform's connect IPC. Throw to abort the open. */
    protected abstract connectIpc(): Promise<IpcConnectResult>

    async connect(): Promise<Transport> {
        const result = await this.connectIpc()
        if (result.label) this.label = result.label
        const id = result.connectionId
        // An event without an id (or a connect without one) can't be told
        // apart, so it is taken as ours.
        const mine = (eventId?: number): boolean =>
            id === undefined || eventId === undefined || eventId === id

        const writable = new WritableStream<Uint8Array>({
            write: (chunk) => this.platform.sendData(new Uint8Array(chunk), id),
        })

        const { writable: respWritable, readable } = new TransformStream<
            Uint8Array,
            Uint8Array
        >()
        const responseWriter = respWritable.getWriter()

        const unlistenData = await this.platform.onConnectionData(
            async (bytes, eventId) => {
                if (!mine(eventId)) return
                try {
                    await responseWriter.write(bytes)
                } catch {
                    /* stream closed */
                }
            },
        )

        let unlistenDisc: Unlisten = () => {}
        unlistenDisc = await this.platform.onConnectionDisconnected(
            (eventId) => {
                if (!mine(eventId)) return
                unlistenData()
                unlistenDisc()
                responseWriter.close().catch(() => {})
            },
        )

        const signal = this.abortController.signal
        const onAbort = async (): Promise<void> => {
            unlistenData()
            unlistenDisc()
            responseWriter.close().catch(() => {})
            await this.platform.close(id).catch(() => {})
            signal.removeEventListener('abort', onAbort)
        }
        signal.addEventListener('abort', onAbort)

        return {
            label: this.label,
            abortController: this.abortController,
            readable,
            writable,
        }
    }
}

/**
 * Electron PlatformIpc strategy. window.api.on returns a sync unlisten;
 * wrap in Promise.resolve to satisfy the async contract.
 */
export const electronIpc: PlatformIpc = {
    async sendData(data, connectionId) {
        await window.api.invoke(
            IpcChannels.TRANSPORT_SEND_DATA,
            data,
            connectionId,
        )
    },
    async close(connectionId) {
        await window.api.invoke(IpcChannels.TRANSPORT_CLOSE, connectionId)
    },
    async onConnectionData(cb) {
        const unlisten = window.api.on(
            IpcEvents.CONNECTION_DATA,
            (...args: unknown[]) => {
                const data = args[0] as number[]
                cb(new Uint8Array(data), args[1] as number | undefined)
            },
        )
        return unlisten
    },
    async onConnectionDisconnected(cb) {
        return window.api.on(
            IpcEvents.CONNECTION_DISCONNECTED,
            (...args: unknown[]) => cb(args[0] as number | undefined),
        )
    },
}
