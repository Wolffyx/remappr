// pattern-check: skip — the open-a-service steps Try Demo and the generic input devices share, lifted out of connectDemo.ts; one function, no abstraction.
import type { KeyboardService } from '@firmware/service'
import useConnectionStore from '@/stores/connectionStore'
import undoRedoStore from '@/stores/undoRedoStore'

/** Make the service `open` resolves to the connected device. Whatever is
 *  connected closes first, so its edit history never carries over; the app
 *  returns to the start page when the new one closes. Nothing opens when the
 *  user chose to stay on a device with unsaved edits. */
export async function openService(
    open: () => Promise<KeyboardService>,
    communication?: 'serial' | 'ble' | 'hid',
): Promise<void> {
    const store = useConnectionStore.getState()
    if (store.service && !(await store.disconnect())) return
    undoRedoStore.getState().reset()
    const next = await open()
    next.onClosed((): void => {
        const s = useConnectionStore.getState()
        s.setDeviceName(null)
        s.setService(null)
    })
    store.setDeviceName(next.deviceInfo.name)
    await store.publishService(next, communication)
}
