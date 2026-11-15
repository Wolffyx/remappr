// Pattern check: Repository (Tier 0) — applied — hides save_device_backup and
// the backup lookup behind save / find, keyed by a per-account device key.
//
// Cloud copies of keyboard profile backups (opt-in per device). One private
// `backup` item per physical unit and account: device_key = sha256(account ‖
// serial), so the same board never links across accounts. The serial itself and
// the local "don't ask" marker are stripped before upload. Only backups keyed
// by a hardware serial sync; host-local keys would not match anywhere else.
import type { CloudClient } from '@/lib/cloud/client'
import type { Json } from '@/lib/cloud/database.types'
import type { ProfileBackup } from '@/stores/profileBackupStore'

export interface DeviceBackupRepository {
    save(backup: ProfileBackup): Promise<void>
    /** The cloud backup of the unit with this serial, or null. */
    find(serialNumber: string): Promise<ProfileBackup | null>
}

export async function cloudDeviceKey(
    accountId: string,
    serialNumber: string,
): Promise<string> {
    const bytes = new TextEncoder().encode(`${accountId}:${serialNumber}`)
    const digest = await crypto.subtle.digest('SHA-256', bytes)
    return [...new Uint8Array(digest)]
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('')
}

/** The document stored in the cloud: the backup minus serial and dismissal. */
export function backupDocument(backup: ProfileBackup): Record<string, unknown> {
    const doc: Record<string, unknown> = {
        kind: 'remappr.backup',
        schemaVersion: 1,
        ...backup,
    }
    delete doc.serialNumber
    delete doc.dismissedHash
    delete doc.cloud
    return doc
}

function backupFromDocument(
    doc: Record<string, unknown>,
    serialNumber: string,
): ProfileBackup | null {
    const b = { ...doc } as Partial<ProfileBackup> & Record<string, unknown>
    delete b.kind
    delete b.schemaVersion
    if (!b.keymap || typeof b.hash !== 'string') return null
    return { ...(b as ProfileBackup), serialNumber, cloud: true }
}

export function createDeviceBackupRepository(
    client: CloudClient,
    accountId: string,
): DeviceBackupRepository {
    return {
        async save(backup) {
            if (!backup.serialNumber) return
            const { error } = await client.rpc('save_device_backup', {
                p_backup: {
                    device_key: await cloudDeviceKey(
                        accountId,
                        backup.serialNumber,
                    ),
                    device_name: backup.deviceName,
                    firmware: backup.firmware,
                    document: backupDocument(backup),
                } as Json,
            })
            if (error) throw error
        },
        async find(serialNumber) {
            const key = await cloudDeviceKey(accountId, serialNumber)
            const { data: item, error } = await client
                .from('library_items')
                .select('id, head_version')
                .eq('type', 'backup')
                .is('deleted_at', null)
                .eq('meta->>device_key', key)
                .maybeSingle()
            if (error) throw error
            if (!item) return null
            const { data: version, error: vError } = await client
                .from('library_item_versions')
                .select('document')
                .eq('item_id', item.id)
                .eq('version', item.head_version)
                .maybeSingle()
            if (vError) throw vError
            return version
                ? backupFromDocument(
                      version.document as Record<string, unknown>,
                      serialNumber,
                  )
                : null
        },
    }
}
