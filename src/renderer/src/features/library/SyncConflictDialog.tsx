// Pattern check: no GoF pattern (-) — rejected — presentational dialog; the
// three resolutions are syncStore.resolveConflict strategies.
//
// An entry changed on this device and in the cloud. Show both sides' facts and
// let the user keep theirs, take the cloud's, or keep both.
import { useEffect, useState } from 'react'
import { CloudAlert } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/ui/button'
import { Modal } from '@/ui/modal'
import type { ConflictChoice } from '@/lib/library/syncEngine'
import type { LibraryEntry, NewLibraryEntry } from '@/lib/library/types'
import useSyncStore from '@/stores/syncStore'
import { summaryFacts } from './entryFacts'

function Side({
    label,
    name,
    facts,
}: {
    label: string
    name: string
    facts: string
}): JSX.Element {
    return (
        <div className="min-w-0 flex-1 rounded-xl border border-border bg-background p-3">
            <div className="eyebrow mb-1">{label}</div>
            <div className="truncate text-panel-title font-semibold">
                {name}
            </div>
            <div className="text-xs text-muted-foreground">{facts}</div>
        </div>
    )
}

export function SyncConflictDialog({
    entry,
    onClose,
}: {
    entry: LibraryEntry | null
    onClose: () => void
}): JSX.Element {
    const resolve = useSyncStore((s) => s.resolveConflict)
    const cloudCopy = useSyncStore((s) => s.cloudCopy)
    const [cloud, setCloud] = useState<NewLibraryEntry | null>(null)
    const [busy, setBusy] = useState(false)

    useEffect(() => {
        if (!entry) return
        let live = true
        void cloudCopy(entry.localId).then((c) => {
            if (live) setCloud(c)
        })
        return () => {
            live = false
            setCloud(null)
        }
    }, [entry, cloudCopy])

    const choose = async (choice: ConflictChoice): Promise<void> => {
        if (!entry) return
        setBusy(true)
        try {
            await resolve(entry.localId, choice)
            toast.success(`"${entry.name}" is in sync again`)
            onClose()
        } finally {
            setBusy(false)
        }
    }

    return (
        <Modal
            size="sm"
            opened={!!entry}
            onClose={onClose}
            title="Changed in two places"
            subtitle={
                entry
                    ? `"${entry.name}" was edited here and in the cloud`
                    : undefined
            }
            headerIcon={<CloudAlert />}
            footer={
                <div className="flex w-full flex-wrap justify-end gap-2">
                    <Button
                        variant="ghost"
                        disabled={busy}
                        onClick={() => void choose('both')}
                    >
                        Keep both
                    </Button>
                    <Button
                        variant="outline"
                        disabled={busy}
                        onClick={() => void choose('cloud')}
                    >
                        Use the cloud version
                    </Button>
                    <Button disabled={busy} onClick={() => void choose('mine')}>
                        Keep this device’s
                    </Button>
                </div>
            }
        >
            {entry && (
                <div className="flex flex-col gap-2 sm:flex-row">
                    <Side
                        label="This device"
                        name={entry.name}
                        facts={summaryFacts(entry.summary, entry.updatedAt)}
                    />
                    <Side
                        label={`Cloud · version ${entry.sync.remoteVersion ?? '?'}`}
                        name={cloud?.name ?? '…'}
                        facts={cloud ? summaryFacts(cloud.summary) : 'Loading…'}
                    />
                </div>
            )}
        </Modal>
    )
}
