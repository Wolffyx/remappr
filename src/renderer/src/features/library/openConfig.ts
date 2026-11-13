// pattern-check: skip — extracted import flow (parse → demo rebuild), one function.
//
// Load a `remappr.keymap` document into the editor: the Export dialog's import
// and the Library's Open share this.
import { connectMockWithConfig } from '@firmware'
import useConfigStore from '@/stores/configStore'
import useConnectionStore from '@/stores/connectionStore'

/** Parse `source` into the editor config. Returns false when it is invalid
 *  (configStore.error holds why). */
export async function openConfigSource(source: string): Promise<boolean> {
    if (!useConfigStore.getState().loadFromSource(source)) return false
    // In demo mode the keyboard on screen comes from the mock service, not
    // configStore, so rebuild the mock from the new config to show it.
    const conn = useConnectionStore.getState()
    const cfg = useConfigStore.getState().config
    if (!cfg || !conn.service?.capabilities.demo) return true
    const next = connectMockWithConfig(cfg)
    next.onClosed((): void => useConnectionStore.getState().serviceClosed(next))
    conn.setDeviceName(next.deviceInfo.name)
    await conn.publishService(next)
    return true
}
