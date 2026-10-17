// Pattern check: no GoF pattern (-) — rejected — App's onConnect lifted into a module and split into open / publish, so the start page and the sidebar's Switch device share one connect path; plain async functions.
import { toast } from 'sonner'
import type { Transport } from '@firmware'
import { pickAdapter, UserCancelledError } from '@firmware'
import type { KeyboardService } from '@firmware/service'
import { rememberConnectedDeviceName } from '@/transport/web-serial'
import { ensureFirmwareClientsLoaded } from '@/transport/adapter/firmwareClients'
import { withSaveMode } from '@/lib/saveMode'
import { withUnlockPrompt } from '@/lib/unlockPrompt'
import useConnectionStore from '@/stores/connectionStore'
import { confirmLeave } from '@/stores/leaveGuardStore'
import undoRedoStore from '@/stores/undoRedoStore'
import useUserSettingsStore from '@/stores/userSettingsStore'
import type { DeviceWithTransport } from './types'

export type Communication = 'serial' | 'ble' | 'hid'

// Abort a connect that hangs (a silent / half-flashed device) so the UI
// recovers instead of sitting on "Connecting" forever. Generous enough not to
// trip a slow-but-valid BLE link.
const CONNECT_TIMEOUT_MS = 15_000

/** A device whose adapter handshake succeeded, not yet shown. */
interface OpenedDevice {
    service: KeyboardService
    /** The connected service as the app holds it (save mode, unlock prompt). */
    wrapped: KeyboardService
    abort: AbortController
}

/** Toast a failed connect, except when the user cancelled a picker. */
export function reportConnectError(e: unknown, fallback: string): void {
    if (e instanceof UserCancelledError) return
    if (e instanceof DOMException && e.name === 'NotFoundError') return
    if (e instanceof Error) {
        toast.error(fallback, { description: e.message })
    }
}

/** Run the adapter handshake on `t`. Null (after a toast) when no adapter
 *  takes the device or the handshake fails or times out. Shows nothing. */
async function openDevice(
    t: Transport,
    communication: Communication,
): Promise<OpenedDevice | null> {
    const adapter = await pickAdapter(t, { transportKind: communication })
    if (!adapter) {
        toast.error('Failed to connect to the selected device.', {
            description: 'No firmware adapter handled the device.',
        })
        return null
    }
    // Fresh controller per attempt: the handshake can hang on a silent device,
    // so a timeout aborts it (adapter.connect honours the signal).
    const abort = new AbortController()
    const timeout = setTimeout(
        () => abort.abort(new Error('Connection timed out')),
        CONNECT_TIMEOUT_MS,
    )
    try {
        const service = await adapter.connect(t, abort.signal)
        // Re-apply a previously imported QMK/VIA/Keychron layout BEFORE the
        // service is exposed, so the first keymap read already reflects it
        // (and never races the editor's own first read on the transport).
        await service.sideload?.restoreCached?.().catch((err: unknown) => {
            console.warn('Failed to restore cached layout', err)
        })
        // Save mode (Settings → Communication → Auto-save) and, for an
        // 'actions' lock (Vial), the unlock-and-retry prompt.
        const wrapped = withUnlockPrompt(
            withSaveMode(service, useUserSettingsStore.getState().autosave),
        )
        return { service, wrapped, abort }
    } catch (err) {
        toast.error('Failed to connect to the selected device.', {
            description: err instanceof Error ? err.message : String(err),
        })
        return null
    } finally {
        clearTimeout(timeout)
    }
}

/** Show an opened device as the connected one. */
async function publishDevice(
    opened: OpenedDevice,
    communication: Communication,
): Promise<void> {
    const store = useConnectionStore.getState()
    // Disconnect aborts whichever controller is live.
    store.setConnectionAbort(opened.abort)
    opened.service.onClosed((): void => {
        const s = useConnectionStore.getState()
        s.setDeviceName(null)
        s.setService(null)
    })
    store.setDeviceName(opened.service.deviceInfo.name)
    if (communication === 'serial') {
        rememberConnectedDeviceName(opened.service.deviceInfo.name)
    }
    await store.publishService(opened.wrapped, communication)
    // The client's own notes on how this connection was made (e.g. it had to
    // fall back to a reduced mode) — shown once, never silent.
    for (const notice of opened.service.connectNotices ?? []) {
        toast[notice.level](notice.title, { description: notice.description })
    }
}

/** Connect `t` from the start page. Resolves true once the device is shown,
 *  false when the handshake failed (already reported). */
export async function connectTransport(
    t: Transport,
    communication: Communication,
): Promise<boolean> {
    const opened = await openDevice(t, communication)
    if (!opened) return false
    await publishDevice(opened, communication)
    return true
}

/**
 * Switch from the connected device to `target`. Asks first when the current
 * device holds unsaved edits; opens the new device before closing the old one,
 * so a failed connect leaves the user where they were and a good one never
 * passes through the start page. Resolves true once `target` is shown.
 */
export async function switchToDevice(
    target: DeviceWithTransport,
): Promise<boolean> {
    if (!(await confirmLeave(useConnectionStore.getState().service))) {
        return false
    }
    const { device, transport } = target
    const communication = transport.communication
    let opened: OpenedDevice | null
    try {
        await ensureFirmwareClientsLoaded()
        const rpc = await transport.pick_and_connect!.connect(device)
        opened = await openDevice(rpc, communication)
    } catch (e) {
        console.error('Connection error:', e)
        reportConnectError(e, 'Failed to connect to the selected device.')
        return false
    }
    if (!opened) return false
    if (!(await useConnectionStore.getState().disconnect())) {
        // Edits came back on the old device and the user chose to stay.
        await opened.service.disconnect().catch((e: unknown) => {
            console.warn('Failed to close the device not switched to', e)
        })
        return false
    }
    undoRedoStore.getState().reset()
    useConnectionStore
        .getState()
        .setLastConnectedDevice({ id: device.id, label: device.label })
    await publishDevice(opened, communication)
    return true
}
