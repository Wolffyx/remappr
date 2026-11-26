// pattern-check: skip — two thin calls joining authStore, the cloud client and
// the device backup repository; errors are logged, never thrown to the caller.
//
// Cloud copies of keyboard backups, for the devices the user opted in. A push
// follows every local capture; on a machine with no local backup the cloud copy
// seeds it, so the usual restore prompt can offer it.
import { createLogger } from '@shared/logger'
import { getCloudClient } from '@/lib/cloud/client'
import { cloudErrorMessage } from '@/lib/cloud/errors'
import { createDeviceBackupRepository } from '@/lib/library/deviceBackups'
import useAuthStore from '@/stores/authStore'
import type { ProfileBackup } from '@/stores/profileBackupStore'

const log = createLogger('CloudBackup')

async function repository(): Promise<ReturnType<
    typeof createDeviceBackupRepository
> | null> {
    const account = useAuthStore.getState().user?.id
    const client = account ? await getCloudClient() : null
    return client && account
        ? createDeviceBackupRepository(client, account)
        : null
}

/** Upload an opted-in backup. Resolves false when it could not be sent. */
export async function pushBackupToCloud(
    backup: ProfileBackup,
): Promise<boolean> {
    if (!backup.cloud || !backup.serialNumber) return false
    const repo = await repository()
    if (!repo) return false
    try {
        await repo.save(backup)
        return true
    } catch (e) {
        log.error('backup upload failed', cloudErrorMessage(e))
        return false
    }
}

/** The signed-in account's cloud backup of this unit, or null. */
export async function pullBackupFromCloud(
    serialNumber: string | undefined,
): Promise<ProfileBackup | null> {
    if (!serialNumber) return null
    const repo = await repository()
    if (!repo) return null
    try {
        return await repo.find(serialNumber)
    } catch (e) {
        log.error('backup lookup failed', cloudErrorMessage(e))
        return null
    }
}
