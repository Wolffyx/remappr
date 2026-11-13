// Pattern check: Observer (Tier 1) — extended — follows connectionStore and service.onPendingChangesChanged (existing observer seams) and mirrors the unsaved flag to the main process.
import type { KeyboardService } from '@firmware/service'
import { IpcChannels, IpcEvents, type ElectronIpcApi } from '@shared/ipc-types'
import { isSaveModeManaged } from '@/lib/saveMode'
import useConnectionStore from '@/stores/connectionStore'
import { confirmLeave, hasUnsavedChanges } from '@/stores/leaveGuardStore'

/**
 * The Electron half of the unsaved-changes guard. Tells the main process
 * whether the connected device holds unsaved edits, so it holds a leave
 * (closing the window, quitting, the reload keys) only then, and answers the
 * leave it held with the user's choice from the in-app Save / Discard /
 * Cancel prompt. Returns the teardown.
 */
export function installWindowLeaveGuard(
    api: Pick<ElectronIpcApi, 'invoke' | 'on'>,
): () => void {
    let reported: boolean | null = null
    const report = (unsaved: boolean): void => {
        if (unsaved === reported) return
        reported = unsaved
        api.invoke(IpcChannels.WINDOW_SET_UNSAVED, unsaved).catch(
            (e: unknown) => console.warn('Failed to report unsaved changes', e),
        )
    }

    let offPending: (() => void) | null = null
    const follow = (service: KeyboardService | null): void => {
        offPending?.()
        offPending = null
        report(hasUnsavedChanges(service))
        if (!service || !isSaveModeManaged(service)) return
        offPending = service.onPendingChangesChanged(report)
    }

    follow(useConnectionStore.getState().service)
    const offService = useConnectionStore.subscribe((s, prev) => {
        if (s.service !== prev.service) follow(s.service)
    })

    const answerLeave = async (): Promise<void> => {
        const leave = await confirmLeave(useConnectionStore.getState().service)
        await api.invoke(IpcChannels.WINDOW_LEAVE_DECIDED, leave)
    }
    const offLeave = api.on(IpcEvents.WINDOW_LEAVE_REQUESTED, () => {
        answerLeave().catch((e: unknown) =>
            console.error('Failed to answer the window leave', e),
        )
    })

    return (): void => {
        offPending?.()
        offService()
        offLeave()
    }
}
