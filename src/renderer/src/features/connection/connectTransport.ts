// Pattern check: no GoF pattern (-) — rejected — App's onConnect lifted into a module and split into open / publish, so the start page and the sidebar's Switch device share one connect path; plain async functions.
import { toast } from 'sonner'
import type { Transport } from '@firmware'
import { pickAdapter, UserCancelledError } from '@firmware'
import type { KeyboardService } from '@firmware/service'
import type { LockState } from '@firmware/types'
import { rememberConnectedDeviceName } from '@/transport/web-serial'
import { ensureFirmwareClientsLoaded } from '@/transport/adapter/firmwareClients'
import { withSaveMode } from '@/lib/saveMode'
import { withUnlockPrompt } from '@/lib/unlockPrompt'
import useConnectionStore, {
    readLockState,
    type OpenDevices,
} from '@/stores/connectionStore'
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

/** Show an opened device as the connected one. With its lock state known,
 *  everything up to the service landing in the store runs in one tick. */
async function publishDevice(
    opened: OpenedDevice,
    communication: Communication,
    lockState?: LockState,
): Promise<void> {
    const store = useConnectionStore.getState()
    // Disconnect aborts whichever controller is live.
    store.setConnectionAbort(opened.abort)
    opened.service.onClosed((): void =>
        useConnectionStore.getState().serviceClosed(opened.wrapped),
    )
    store.setDeviceName(opened.service.deviceInfo.name)
    if (communication === 'serial') {
        rememberConnectedDeviceName(opened.service.deviceInfo.name)
    }
    await store.publishService(opened.wrapped, communication, lockState)
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

/** Open `target`'s transport and run the handshake; null (after a toast)
 *  when that fails. */
async function openTarget(
    target: DeviceWithTransport,
): Promise<OpenedDevice | null> {
    const { device, transport } = target
    try {
        await ensureFirmwareClientsLoaded()
        const rpc = await transport.pick_and_connect!.connect(device)
        return await openDevice(rpc, transport.communication)
    } catch (e) {
        console.error('Connection error:', e)
        reportConnectError(e, 'Failed to connect to the selected device.')
        return null
    }
}

/** The devices open now, for closing once the switch no longer shows them. */
function openDevices(): OpenDevices {
    const { service, parentService, connectionAbort } =
        useConnectionStore.getState()
    return { service, parentService, connectionAbort }
}

/** Show `opened` as `target`, with a fresh edit history, in one store update:
 *  the screen goes from the device left straight to the next one, never
 *  through the start page. */
async function showTarget(
    target: DeviceWithTransport,
    opened: OpenedDevice,
): Promise<void> {
    const lockState = await readLockState(opened.wrapped)
    const store = useConnectionStore.getState()
    undoRedoStore.getState().reset()
    store.resetConnection()
    store.setLastConnectedDevice({
        id: target.device.id,
        label: target.device.label,
    })
    await publishDevice(opened, target.transport.communication, lockState)
}

/** Close the current device, then open `target`; the device left stays on
 *  screen meanwhile. A failed open lands on the start page. */
async function closeThenOpen(target: DeviceWithTransport): Promise<boolean> {
    const store = useConnectionStore.getState()
    await store.closeDevices(openDevices())
    const opened = await openTarget(target)
    if (!opened) {
        store.resetConnection()
        store.setConnectionAbort(new AbortController())
        return false
    }
    await showTarget(target, opened)
    return true
}

/** Open `target` beside the current device, show it, then close the device
 *  left, so a failed open leaves the user where they were. */
async function openThenClose(target: DeviceWithTransport): Promise<boolean> {
    const opened = await openTarget(target)
    if (!opened) return false
    const left = openDevices()
    await showTarget(target, opened)
    await useConnectionStore.getState().closeDevices(left)
    return true
}

/** A switch is running; another click waits for it instead of racing it. */
let switching = false

/**
 * Switch from the connected device to `target`. Asks first when the current
 * device holds unsaved edits. Opens the new device before closing the old
 * one, so a failed connect leaves the user where they were and a good one
 * never passes through the start page — except on a single-link transport
 * already holding the current device, where opening would close it first.
 * Resolves true once `target` is shown; false while another switch runs.
 */
export async function switchToDevice(
    target: DeviceWithTransport,
): Promise<boolean> {
    if (switching) return false
    switching = true
    const store = useConnectionStore.getState()
    // The device left closes during the switch; its close must not clear
    // the connection on the way to the next one.
    store.setSwitching(true)
    try {
        const { service, communication } = useConnectionStore.getState()
        if (!(await confirmLeave(service))) return false
        const sameLink =
            !!target.transport.singleLink &&
            communication === target.transport.communication
        return sameLink
            ? await closeThenOpen(target)
            : await openThenClose(target)
    } finally {
        store.setSwitching(false)
        switching = false
    }
}
