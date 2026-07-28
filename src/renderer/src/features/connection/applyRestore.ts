// Pattern check: no GoF pattern (-) — rejected — thin app-layer wrapper binding
// restoreProfile to the stores + toasts; shared by the auto/prompt and manual
// entry points so the side effects live in one place. No abstraction.
import { toast } from 'sonner'
import useConnectionStore from '@/stores/connectionStore'
import useKeymapStore from '@/stores/keymapStore'
import useProfileBackupStore, {
    keymapHash,
    type ProfileBackup,
} from '@/stores/profileBackupStore'
import { restoreProfile } from './restoreProfile'
import type { KeyboardService } from '@firmware/service'

/**
 * Restore a backup to the live device and reconcile app state: refresh the
 * editor keymap and sync the stored hash to the restored layout so detection
 * treats the device as in-sync afterwards. Refuses when the device is locked.
 * Returns true on success. Toasts on every outcome.
 */
export async function applyRestore(
    service: KeyboardService,
    backup: ProfileBackup,
    key: string,
): Promise<boolean> {
    if (useConnectionStore.getState().lockState === 'locked') {
        toast.error('Unlock the keyboard first, then restore its profile.')
        return false
    }
    try {
        const km = await restoreProfile(service, backup)
        useKeymapStore.getState().setKeymap(km)
        useProfileBackupStore.getState().saveBackup(key, {
            ...backup,
            hash: keymapHash(km),
            dismissedHash: undefined,
        })
        const n = backup.keymap.layers.length
        toast.success('Profile restored', {
            description: `Recovered ${n} layer${n === 1 ? '' : 's'} to the keyboard.`,
        })
        return true
    } catch (e) {
        toast.error('Failed to restore profile', {
            description: e instanceof Error ? e.message : String(e),
        })
        return false
    }
}
