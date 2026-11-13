// pattern-check: skip — presentational pieces for the cloud side of the
// History panel (a loading hook, a row, a detail pane).
//
// Saved versions of a synced entry that only the cloud has (checkpoints from
// another device, GitHub versions, releases). Picking one fetches its
// document; it can be compared with the current one, restored or copied.
import { useEffect, useState } from 'react'
import { Cloud } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/ui/badge'
import { Button } from '@/ui/button'
import {
    cloudVersionDocument,
    type CloudVersionInfo,
} from '@/lib/library/cloudHistory'
import type { LibraryEntry } from '@/lib/library/types'
import useHistoryStore, { type PastDocument } from '@/stores/historyStore'
import { VersionDiff } from './VersionDiff'

function badgeOf(v: CloudVersionInfo): string {
    if (v.releaseNo !== null) return `Release ${v.releaseNo}`
    return v.kind === 'github' ? 'GitHub' : 'Version'
}

function when(iso: string): string {
    return new Date(iso).toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    })
}

export function CloudVersionRow({
    version,
    selected,
    onSelect,
}: {
    version: CloudVersionInfo
    selected: boolean
    onSelect: () => void
}): JSX.Element {
    return (
        <li>
            <button
                type="button"
                onClick={onSelect}
                aria-current={selected}
                className={`w-full rounded-lg px-2 py-1.5 text-left text-xs ${
                    selected ? 'bg-accent' : 'hover:bg-accent/50'
                }`}
            >
                <span className="flex items-center gap-2">
                    <Cloud className="size-3 text-muted-foreground" />
                    <span className="font-mono text-muted-foreground">
                        v{version.version}
                    </span>
                    <Badge tone="info" size="sm">
                        {badgeOf(version)}
                    </Badge>
                    <span className="ml-auto text-muted-foreground">
                        {when(version.createdAt)}
                    </span>
                </span>
                {version.message && (
                    <span className="mt-0.5 block truncate">
                        {version.message}
                    </span>
                )}
            </button>
        </li>
    )
}

export function CloudVersionDetail({
    entry,
    version,
    accountId,
    onOpen,
}: {
    entry: LibraryEntry
    version: CloudVersionInfo
    accountId: string | null
    onOpen?: (entry: LibraryEntry) => void
}): JSX.Element {
    const [doc, setDoc] = useState<PastDocument | null | 'loading'>('loading')
    useEffect(() => {
        let live = true
        cloudVersionDocument(entry, accountId, version.version)
            .then((d) => live && setDoc(d))
            .catch(() => live && setDoc(null))
        return () => {
            live = false
        }
        // The document of one cloud version never changes.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [version.version])

    const restore = async (past: PastDocument): Promise<void> => {
        await useHistoryStore
            .getState()
            .restoreDocument(
                entry.localId,
                past,
                `Restored cloud version ${version.version}`,
            )
        toast.success(`Restored cloud version ${version.version}`, {
            ...(onOpen
                ? { action: { label: 'Open', onClick: () => onOpen(entry) } }
                : {}),
        })
    }
    const copy = async (past: PastDocument): Promise<void> => {
        const made = await useHistoryStore
            .getState()
            .copyDocument(
                entry.localId,
                past,
                `${entry.name} (cloud version ${version.version})`,
            )
        if (made) toast.success(`Saved as "${made.name}"`)
    }

    if (doc === 'loading')
        return <p className="text-xs text-muted-foreground">Loading…</p>
    if (!doc)
        return (
            <p className="text-xs text-muted-foreground">
                This version could not be read from the cloud.
            </p>
        )
    return (
        <div className="min-w-0 flex-1 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-panel-title font-semibold">
                    Cloud version {version.version}
                </h3>
                <div className="ml-auto flex gap-2">
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={() => void restore(doc)}
                    >
                        Restore
                    </Button>
                    <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => void copy(doc)}
                    >
                        Copy as new
                    </Button>
                </div>
            </div>
            <p className="text-xs text-muted-foreground">
                Compared with the current document
            </p>
            <VersionDiff
                kind={entry.kind}
                before={entry.source}
                after={doc.source}
            />
        </div>
    )
}
