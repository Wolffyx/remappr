// Pattern check: Dispatch Map (Tier 0) — applied — Save / Discard / Cancel each map to one handler; the prompt slice + shared in-flight promise mirrors stores/unlockPromptStore.ts.
import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { toast } from 'sonner'
import type { KeyboardService } from '@firmware/service'
import { isSaveModeManaged } from '@/lib/saveMode'

/**
 * The unsaved-changes guard. Leaving a device (disconnect, back to the dongle,
 * another node, another device) while it holds unsaved edits asks Save /
 * Discard / Cancel first. What can hold edits comes from the service: only one
 * carrying the save-mode controller (lib/saveMode.ts) has anything to save, so
 * a demo (saveMode 'none') or a read-only view never asks. With Auto-save on,
 * edits still waiting for the debounced save are saved on the way out.
 */
export type LeaveChoice = 'save' | 'discard' | 'cancel'

interface LeaveGuardState {
    /** The device being left while the prompt is open; null when closed. */
    deviceName: string | null
    /** The choice being carried out (its button shows progress). */
    busy: 'save' | 'discard' | null
    choose: (choice: LeaveChoice) => void
}

interface Pending {
    service: KeyboardService
    promise: Promise<boolean>
    resolve: (leave: boolean) => void
}

let pending: Pending | null = null

const useLeaveGuardStore = create<LeaveGuardState>()(
    devtools(
        () => ({
            deviceName: null,
            busy: null,
            choose: (choice: LeaveChoice): void => {
                const p = pending
                if (!p || useLeaveGuardStore.getState().busy) return
                void CHOICES[choice](p)
            },
        }),
        { name: 'leaveGuard' },
    ),
)

function finish(p: Pending, leave: boolean): void {
    if (pending !== p) return
    pending = null
    useLeaveGuardStore.setState({ deviceName: null, busy: null })
    p.resolve(leave)
}

const errorText = (e: unknown, fallback: string): string =>
    e instanceof Error ? e.message : fallback

async function save(p: Pending): Promise<void> {
    useLeaveGuardStore.setState({ busy: 'save' })
    try {
        await p.service.commit()
    } catch (e) {
        // Stay: the edits are still there to save again, discard or keep.
        console.error('Failed to save changes before leaving', e)
        toast.error(errorText(e, 'Failed to save changes'))
        if (pending === p) useLeaveGuardStore.setState({ busy: null })
        return
    }
    finish(p, true)
}

async function discard(p: Pending): Promise<void> {
    useLeaveGuardStore.setState({ busy: 'discard' })
    try {
        await p.service.discardChanges()
    } catch (e) {
        // Leave anyway: the user chose to drop the edits, and a device that no
        // longer answers must not keep them from leaving it.
        console.warn('Failed to discard changes before leaving', e)
        toast.warning('Could not discard the changes on the device', {
            description: errorText(e, 'The device did not answer.'),
        })
    }
    finish(p, true)
}

const CHOICES: Record<LeaveChoice, (p: Pending) => Promise<void>> = {
    save,
    discard,
    cancel: async (p) => finish(p, false),
}

function hasUnsaved(service: KeyboardService): boolean {
    return isSaveModeManaged(service) && service.hasPendingChanges()
}

/** With Auto-save on, save what the debounce has not yet. False when that
 *  save fails, so the user decides instead. */
async function flushAutoSave(service: KeyboardService): Promise<boolean> {
    if (service.capabilities.saveMode !== 'automatic') return false
    try {
        await service.commit()
        return true
    } catch (e) {
        console.warn('Auto-save before leaving failed', e)
        return false
    }
}

function ask(service: KeyboardService): Promise<boolean> {
    if (pending) finish(pending, false)
    let resolve!: (leave: boolean) => void
    const promise = new Promise<boolean>((r) => (resolve = r))
    pending = { service, promise, resolve }
    useLeaveGuardStore.setState({
        deviceName: service.deviceInfo.name?.trim() || 'this device',
        busy: null,
    })
    return promise
}

/**
 * Whether the user may leave `service` now. Resolves true at once when there
 * is nothing unsaved; otherwise asks, and resolves true once the edits are
 * saved or discarded, false when the user stays. Concurrent callers for the
 * same service share the one prompt.
 */
export async function confirmLeave(
    service: KeyboardService | null,
): Promise<boolean> {
    if (!service || !hasUnsaved(service)) return true
    if (pending?.service === service) return pending.promise
    if (await flushAutoSave(service)) return true
    return ask(service)
}

/** Close an open prompt because the device went away: nothing is left to keep,
 *  so the waiting leave goes ahead. */
export function dismissLeavePrompt(): void {
    if (pending) finish(pending, true)
}

export default useLeaveGuardStore
