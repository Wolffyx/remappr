// pattern-check: skip — one IPC call wrapper; mice are only enumerable through the Electron main process.
import { IpcChannels, type HidMousePayload } from '@shared/ipc-types'
import { getApi } from './api'

/** Every HID mouse the OS lists; empty outside Electron (a browser cannot
 *  enumerate mice: WebHID blocks pointer collections). */
export async function listHidMice(): Promise<HidMousePayload[]> {
    const api = getApi()
    if (!api) return []
    return (await api.invoke(IpcChannels.HID_LIST_MICE)) as HidMousePayload[]
}
