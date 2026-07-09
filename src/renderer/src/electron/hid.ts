// Pattern check: Adapter (Tier 1) — extended — bridges Electron HID_CONNECT IPC into IpcTransportAdapter contract
import type { HidDiscoveryPayload } from '../../../shared/ipc-types'
import { IpcChannels } from '../../../shared/ipc-types'
import type { AvailableDevice } from '../transport/types'
import {
    electronIpc,
    type IpcConnectResult,
    IpcTransportAdapter,
} from '../transport/adapter/ipc-adapter'
import { registerTransport } from '../transport/adapter/registry'

export class ElectronHidAdapter extends IpcTransportAdapter {
    constructor(private readonly dev: AvailableDevice) {
        super(electronIpc, dev.label)
    }

    protected async connectIpc(): Promise<IpcConnectResult> {
        const result = (await window.api.invoke(IpcChannels.HID_CONNECT, {
            device: this.dev,
        })) as { ok: boolean; label?: string; error?: string }
        if (!result.ok) {
            throw new Error(result.error ?? 'HID connect failed')
        }
        // HID_CONNECT returns the node-hid device *path* as its label, which has
        // no "vid:pid" token. Overriding with it would strip the VID/PID that
        // readTransportIds() parses out of the discovery label (buildLabel),
        // breaking the QMK/VIA/Keychron layout cache key on Electron. Keep the
        // discovery label, which carries "VVVV:PPPP".
        return { label: this.dev.label }
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
            pick_and_connect: {
                list: () => list_devices({ filters }),
                connect: (dev) => new ElectronHidAdapter(dev).connect(),
            },
        }
    },
})
