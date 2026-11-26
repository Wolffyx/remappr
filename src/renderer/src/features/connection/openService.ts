// pattern-check: skip — the open-a-service steps Try Demo and the generic input devices share, lifted out of connectDemo.ts; one function, no abstraction.
import type { KeyboardService } from '@firmware/service'
import useConnectionStore, { readLockState } from '@/stores/connectionStore'
import { confirmLeave } from '@/stores/leaveGuardStore'
import undoRedoStore from '@/stores/undoRedoStore'

/** Make the service `open` resolves to the connected device. Whatever is
 *  connected closes first, so its edit history never carries over, yet stays
 *  on screen until the next one replaces it in one store update (no start
 *  page between them); the app returns to the start page when the new one
 *  closes, or when it fails to open. Nothing opens when the user chose to
 *  stay on a device with unsaved edits. */
export async function openService(
    open: () => Promise<KeyboardService>,
    communication?: 'serial' | 'ble' | 'hid',
): Promise<void> {
    const store = useConnectionStore.getState()
    const { service, parentService, connectionAbort } = store
    if (service && !(await confirmLeave(service))) return
    // The device left closes below; its close must not clear the connection.
    store.setSwitching(true)
    try {
        await store.closeDevices({ service, parentService, connectionAbort })
        let next: KeyboardService
        try {
            next = await open()
        } catch (e) {
            store.resetConnection()
            store.setConnectionAbort(new AbortController())
            throw e
        }
        const lockState = await readLockState(next)
        undoRedoStore.getState().reset()
        store.resetConnection()
        next.onClosed((): void =>
            useConnectionStore.getState().serviceClosed(next),
        )
        store.setDeviceName(next.deviceInfo.name)
        await store.publishService(next, communication, lockState)
    } finally {
        store.setSwitching(false)
    }
}
