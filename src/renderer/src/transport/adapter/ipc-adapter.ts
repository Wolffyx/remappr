// Pattern check: Template Method (Tier 1) — applied — connect() owns lifecycle, defers connectIpc() to subclasses; PlatformIpc is Strategy
import type { Transport } from '@firmware'
import {
    IpcChannels,
    IpcEvents,
    type LinkId,
} from '../../../../shared/ipc-types'
import { TransportAdapter } from './base'

export type Unlisten = () => void

/**
 * Per-platform IPC primitives. Strategy injected into
 * {@link IpcTransportAdapter}. `onConnectionData` / `onConnectionDisconnected`
 * always return `Promise<Unlisten>` so a sync (Electron) or async subscription
 * source can share one signature. Every call names the link it means, so one
 * adapter never writes to, closes or hears another adapter's link.
 */
export interface PlatformIpc {
    sendData(link: LinkId, data: Uint8Array): Promise<void>

    close(link: LinkId): Promise<void>

    onConnectionData(
        link: LinkId,
        cb: (bytes: Uint8Array) => void,
    ): Promise<Unlisten>

    onConnectionDisconnected(link: LinkId, cb: () => void): Promise<Unlisten>
}

export interface IpcConnectResult {
    /** Display name from the device, falls back to the dev.label passed to the adapter. */
    label?: string
    /** The link main opened for this connection. */
    linkId: LinkId
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
        const link = result.linkId

        const writable = new WritableStream<Uint8Array>({
            write: (chunk) =>
                this.platform.sendData(link, new Uint8Array(chunk)),
        })

        const { writable: respWritable, readable } = new TransformStream<
            Uint8Array,
            Uint8Array
        >()
        const responseWriter = respWritable.getWriter()

        const unlistenData = await this.platform.onConnectionData(
            link,
            async (bytes) => {
                try {
                    await responseWriter.write(bytes)
                } catch {
                    /* stream closed */
                }
            },
        )

        let unlistenDisc: Unlisten = () => {}
        unlistenDisc = await this.platform.onConnectionDisconnected(
            link,
            () => {
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
            await this.platform.close(link).catch(() => {})
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
    async sendData(link, data) {
        await window.api.invoke(IpcChannels.TRANSPORT_SEND_DATA, link, data)
    },
    async close(link) {
        await window.api.invoke(IpcChannels.TRANSPORT_CLOSE, link)
    },
    async onConnectionData(link, cb) {
        return window.api.on(
            IpcEvents.CONNECTION_DATA,
            (...args: unknown[]) => {
                const e = args[0] as { linkId: LinkId; data: number[] }
                if (e.linkId === link) cb(new Uint8Array(e.data))
            },
        )
    },
    async onConnectionDisconnected(link, cb) {
        return window.api.on(
            IpcEvents.CONNECTION_DISCONNECTED,
            (...args: unknown[]) => {
                const e = args[0] as { linkId: LinkId }
                if (e.linkId === link) cb()
            },
        )
    },
}

/** The link id a connect IPC answered with; throws when it carries none. */
export function linkIdOf(result: { linkId?: LinkId }): LinkId {
    if (typeof result.linkId !== 'number') {
        throw new Error('The device connect returned no link')
    }
    return result.linkId
}
