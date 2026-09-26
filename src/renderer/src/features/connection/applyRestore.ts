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
import { restoreProfile, type RestoreIssue } from './restoreProfile'
import type { KeyboardService } from '@firmware/service'

/**
 * Restore a backup to the live device and reconcile app state: refresh the
 * editor keymap and sync the stored hash to the restored layout so detection
 * treats the device as in-sync afterwards. Refuses when the device is locked.
 * Returns true on success. Toasts on every outcome.
 *
 * A restore is a success even when some keys couldn't be written: firmwares
 * can't bind every binding their own compiled keymap holds (ZMK `&ext_power`,
 * `&mmv`, `&msc`, parameterized macros), and those keys are almost always
 * already correct on the device. Those are reported as a warning, not a failure.
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
        const result = await restoreProfile(service, backup)
        useKeymapStore.getState().setKeymap(result.keymap)
        useProfileBackupStore.getState().saveBackup(key, {
            ...backup,
            hash: keymapHash(result.keymap),
            dismissedHash: undefined,
        })

        // Every key the device refused, when nothing at all could be written.
        if (result.written === 0 && result.failed.length > 0) {
            toast.error('Failed to restore profile', {
                description:
                    result.failed[0].message ??
                    'The keyboard rejected every key.',
            })
            return false
        }

        const n = backup.keymap.layers.length
        toast.success('Profile restored', {
            description: `Recovered ${n} layer${n === 1 ? '' : 's'} to the keyboard.`,
        })
        const unwritten = [...result.skipped, ...result.failed]
        if (unwritten.length > 0) {
            toast.warning(
                `${unwritten.length} key${unwritten.length === 1 ? '' : 's'} left unchanged`,
                { description: describeUnwritten(unwritten) },
            )
        }
        return true
    } catch (e) {
        toast.error('Failed to restore profile', {
            description: e instanceof Error ? e.message : String(e),
        })
        return false
    }
}

const MAX_LISTED = 3

function describeUnwritten(issues: RestoreIssue[]): string {
    const listed = issues
        .slice(0, MAX_LISTED)
        .map((i) => `${i.label} on layer ${i.layerName} (key ${i.position})`)
        .join(', ')
    const rest = issues.length - MAX_LISTED
    const more = rest > 0 ? `, and ${rest} more` : ''
    return `${listed}${more}. Your keyboard can't set these over the wire, so they keep the value compiled into its firmware.`
}
