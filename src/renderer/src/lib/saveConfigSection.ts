// Pattern check: no GoF pattern (-) — rejected — one async save routine shared by
// the settings dialogs; stage callback + commit, no abstraction beyond that.
//
// Save one settings section of a device config (Power, Autocorrect, Behaviors,
// Conditional layers, Link profile, Node, Timing defaults).
//
// The device saves its whole staged config at once, so a dialog's Save also
// writes every other edit the user has not saved yet. In manual-save mode that
// is asked first (stores/saveAllPromptStore). With Auto-save on, those edits are
// about to be saved anyway, so nothing is asked.
//
// When the save fails and the dialog's section was the only staged edit, it is
// dropped again: otherwise it would stay staged after the dialog closes and
// ride along, unseen, on the next save. With other edits staged as well, the
// user chose to save them together; they stay staged and the Header still shows
// them as unsaved.
import { toast } from 'sonner'
import type { KeyboardService } from '@firmware/service'
import { askSaveAll } from '@/stores/saveAllPromptStore'
import { toastDeviceError } from './saveWithToast'

export interface ConfigSectionSave {
    service: KeyboardService
    /** What is saved, for the prompt: "Power settings". */
    section: string
    /** Stage the dialog's edits onto the service. */
    stage: () => void
    successMessage: string
    errorPrefix: string
}

/** Stage and save one section. True once it is saved on the device. */
export async function saveConfigSection(
    o: ConfigSectionSave,
): Promise<boolean> {
    const { service } = o
    const hadOtherEdits = service.hasPendingChanges()
    const manual = service.capabilities.saveMode === 'manual'
    if (hadOtherEdits && manual) {
        const name = service.deviceInfo.name?.trim() || 'this device'
        if (!(await askSaveAll(name, o.section))) return false
    }
    o.stage()
    try {
        await service.commit()
    } catch (e) {
        console.error(e)
        toastDeviceError(o.errorPrefix, e)
        if (!hadOtherEdits) await dropStaged(service)
        return false
    }
    toast.success(o.successMessage)
    return true
}

async function dropStaged(service: KeyboardService): Promise<void> {
    try {
        await service.discardChanges()
    } catch (e) {
        console.warn(
            'Could not drop the unsaved section after a failed save',
            e,
        )
    }
}
