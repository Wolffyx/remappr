// Pattern check: Adapter (Tier 1) — extended — bridges Electron HID_CONNECT IPC into IpcTransportAdapter contract
import type { Transport } from '@firmware'
import type {
    HidDiscoveryPayload,
    LinkConnectResult,
    LinkId,
} from '../../../shared/ipc-types'
import { IpcChannels, IpcEvents } from '../../../shared/ipc-types'
import type { AvailableDevice } from '../transport/types'
import {
    electronIpc,
    type IpcConnectResult,
    IpcTransportAdapter,
    linkIdOf,
} from '../transport/adapter/ipc-adapter'
import { registerTransport } from '../transport/adapter/registry'

// pattern-check: skip — extends the existing Adapter with a feature-report member over two IPC channels, no new abstraction.
export class ElectronHidAdapter extends IpcTransportAdapter {
    private link: LinkId | null = null

    constructor(private readonly dev: AvailableDevice) {
        super(electronIpc, dev.label)
    }

    protected async connectIpc(): Promise<IpcConnectResult> {
        const result = (await window.api.invoke(IpcChannels.HID_CONNECT, {
            device: this.dev,
        })) as LinkConnectResult
        if (!result.ok) {
            throw new Error(result.error ?? 'HID connect failed')
        }
        this.link = linkIdOf(result)
        // HID_CONNECT returns the node-hid device *path* as its label, which has
        // no "vid:pid" token. Overriding with it would strip the VID/PID that
        // readTransportIds() parses out of the discovery label (buildLabel),
        // breaking the QMK/VIA/Keychron layout cache key on Electron. Keep the
        // discovery label, which carries "VVVV:PPPP".
        return { label: this.dev.label, linkId: this.link }
    }

    override async connect(): Promise<Transport> {
        const transport = await super.connect()
        const link = this.link
        if (link === null) return transport
        return {
            ...transport,
            feature: {
                send: async (reportId, payload) => {
                    await window.api.invoke(
                        IpcChannels.HID_FEATURE_SEND,
                        link,
                        reportId,
                        payload,
                    )
                },
                receive: async (reportId, length) =>
                    new Uint8Array(
                        (await window.api.invoke(
                            IpcChannels.HID_FEATURE_GET,
                            link,
                            reportId,
                            length,
                        )) as Uint8Array,
                    ),
            },
        }
    }
}

export async function list_devices(
    discovery: HidDiscoveryPayload,
): Promise<Array<AvailableDevice>> {
    return (await window.api.invoke(
        IpcChannels.HID_LIST_DEVICES,
        discovery,
    )) as AvailableDevice[]
}

registerTransport({
    id: 'electron:hid',
    envs: 'electron',
    create(ctx) {
        // Enumerate against EVERY registered firmware family's filter (match-any),
        // not just the primary one, so QMK/VIA and Keychron devices also surface
        // in the Electron HID chooser.
        const filters = ctx.hidDiscoveryAll()
        if (filters.length === 0) return null
        return {
            label: 'HID',
            communication: 'hid',
            singleLink: true,
            pick_and_connect: {
                list: () => list_devices({ filters }),
                connect: (dev) => new ElectronHidAdapter(dev).connect(),
            },
        }
    },
    // The main process polls node-hid and says when the device set changed.
    subscribeChanges(_ctx, cb) {
        return window.api.on(IpcEvents.HID_DEVICES_CHANGED, cb)
    },
})
