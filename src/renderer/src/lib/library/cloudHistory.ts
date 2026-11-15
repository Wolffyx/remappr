// pattern-check: skip — thin reads over CloudLibrary for the History panel,
// plus one pure filter.
//
// The cloud side of a synced entry's history (plan §6c A, P10d): the saved
// versions the cloud has that this machine did not make (checkpoints from
// another device, GitHub versions, releases), and any one version's document.
// Autosaves stay per machine, so the cloud's are not listed.
import { getCloudClient } from '@/lib/cloud/client'
import { createCloudLibrary, type CloudVersionInfo } from './cloudLibrary'
import type { LibraryEntry } from './types'
import type { LocalVersion } from './versionRepo'

export type { CloudVersionInfo } from './cloudLibrary'

/** Versions worth listing that no local version became. */
export function cloudOnlyVersions(
    rows: readonly CloudVersionInfo[],
    local: readonly LocalVersion[],
): CloudVersionInfo[] {
    const mine = new Set(local.map((v) => v.cloudVersion).filter(Boolean))
    return rows.filter(
        (r) =>
            (r.kind !== 'autosave' || r.releaseNo !== null) &&
            !mine.has(r.version),
    )
}

/** The entry's cloud item, when it syncs with the signed-in account. */
async function cloudItem(
    entry: LibraryEntry,
    accountId: string | null,
): Promise<{
    itemId: string
    cloud: ReturnType<typeof createCloudLibrary>
} | null> {
    const itemId = entry.sync.itemId
    if (!itemId || entry.sync.localOnly || !accountId) return null
    if (entry.sync.accountId && entry.sync.accountId !== accountId) return null
    const client = await getCloudClient()
    return client ? { itemId, cloud: createCloudLibrary(client) } : null
}

export async function cloudVersionsOf(
    entry: LibraryEntry,
    accountId: string | null,
): Promise<CloudVersionInfo[]> {
    const item = await cloudItem(entry, accountId)
    return item ? item.cloud.versions(item.itemId) : []
}

/** One cloud version as a past document (its source in the entry's form). */
export async function cloudVersionDocument(
    entry: LibraryEntry,
    accountId: string | null,
    version: number,
): Promise<{ name: string; source: string } | null> {
    const item = await cloudItem(entry, accountId)
    if (!item) return null
    const [row] = await item.cloud.fetch([{ itemId: item.itemId, version }])
    if (!row) return null
    return { name: entry.name, source: JSON.stringify(row.document, null, 2) }
}
