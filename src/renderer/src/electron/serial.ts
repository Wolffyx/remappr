// Pattern check: Adapter (Tier 1) — extended — bridges Electron SERIAL_CONNECT IPC into IpcTransportAdapter contract
import { IpcChannels, IpcEvents } from '../../../shared/ipc-types'
import type { AvailableDevice } from '../transport/types'
import {
    electronIpc,
    type IpcConnectResult,
    IpcTransportAdapter,
} from '../transport/adapter/ipc-adapter'
import { registerTransport } from '../transport/adapter/registry'

export class ElectronSerialAdapter extends IpcTransportAdapter {
    constructor(private readonly dev: AvailableDevice) {
        super(electronIpc, dev.label)
    }

    protected async connectIpc(): Promise<IpcConnectResult> {
        const result = (await window.api.invoke(
            IpcChannels.SERIAL_CONNECT,
            this.dev,
        )) as { ok: boolean; error?: string; connectionId?: number }
        if (!result?.ok) throw new Error(result?.error ?? 'Failed to connect')
        return { label: this.dev.label, connectionId: result.connectionId }
    }
}

export async function list_devices(): Promise<Array<AvailableDevice>> {
    return (await window.api.invoke(
        IpcChannels.SERIAL_LIST_DEVICES,
    )) as AvailableDevice[]
}

export function onDevicesChanged(cb: () => void): () => void {
    return window.api.on(IpcEvents.SERIAL_DEVICES_CHANGED, cb)
}

registerTransport({
    id: 'electron:serial',
    envs: 'electron',
    create() {
        return {
            label: 'USB',
            communication: 'serial',
            exclusive: true,
            pick_and_connect: {
                list: () => list_devices(),
                connect: (dev) => new ElectronSerialAdapter(dev).connect(),
            },
        }
    },
    subscribeChanges(_ctx, cb) {
        return onDevicesChanged(cb)
    },
})
