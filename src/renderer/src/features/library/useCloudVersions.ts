// pattern-check: skip — a loading hook for the History panel's cloud list.
import { useEffect, useState } from 'react'
import {
    cloudOnlyVersions,
    cloudVersionsOf,
    type CloudVersionInfo,
} from '@/lib/library/cloudHistory'
import type { LibraryEntry } from '@/lib/library/types'
import type { LocalVersion } from '@/lib/library/versionRepo'

/** The entry's cloud-only versions, newest first ([] when not synced). */
export function useCloudVersions(
    entry: LibraryEntry | null,
    local: readonly LocalVersion[],
    accountId: string | null,
): CloudVersionInfo[] {
    const [rows, setRows] = useState<CloudVersionInfo[]>([])
    const itemId = entry?.sync.itemId
    const baseVersion = entry?.sync.baseVersion
    useEffect(() => {
        let live = true
        if (!entry || !itemId) return
        cloudVersionsOf(entry, accountId)
            .then((r) => live && setRows(r))
            .catch((e: unknown) =>
                console.warn('[history] cloud versions failed:', e),
            )
        return () => {
            live = false
        }
        // Re-read when the entry syncs a new head, not on every render.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [itemId, baseVersion, accountId])
    return itemId ? cloudOnlyVersions(rows, local).reverse() : []
}
