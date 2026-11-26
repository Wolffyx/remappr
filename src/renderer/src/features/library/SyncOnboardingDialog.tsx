// Pattern check: no GoF pattern (-) — rejected — presentational dialog over
// syncStore.enable / postpone / disable.
//
// Asked once per account, on the first sign-in: sync the local library to the
// cloud? Lists the local entries (all ticked) with the plan's quota, so the
// user sees what fits before anything uploads.
import { useEffect, useMemo, useState } from 'react'
import { CloudUpload } from 'lucide-react'
import { Button } from '@/ui/button'
import { Checkbox } from '@/ui/checkbox'
import { Modal } from '@/ui/modal'
import useLibraryStore from '@/stores/libraryStore'
import useSyncStore from '@/stores/syncStore'
import { isDesktopSignInTab } from '@/lib/cloud/desktopHandoff'
import { summaryFacts } from './entryFacts'

export function SyncOnboardingDialog(): JSX.Element | null {
    const asking = useSyncStore((s) => s.asking)
    const quota = useSyncStore((s) => s.quota)
    const enable = useSyncStore((s) => s.enable)
    const postpone = useSyncStore((s) => s.postpone)
    const disable = useSyncStore((s) => s.disable)
    const refreshQuota = useSyncStore((s) => s.refreshQuota)
    const entries = useLibraryStore((s) => s.entries)
    const load = useLibraryStore((s) => s.load)
    const candidates = useMemo(
        () => entries.filter((e) => !e.sync.itemId && !e.sync.accountId),
        [entries],
    )
    const [unticked, setUnticked] = useState<ReadonlySet<string>>(new Set())
    const [busy, setBusy] = useState(false)

    useEffect(() => {
        if (!asking) return
        void load()
        void refreshQuota()
    }, [asking, load, refreshQuota])

    // A tab that only signs the desktop app in is not where syncing is set up.
    if (!asking || isDesktopSignInTab()) return null

    const selected = candidates.filter((e) => !unticked.has(e.localId))
    const toggle = (localId: string, on: boolean): void => {
        const next = new Set(unticked)
        if (on) next.delete(localId)
        else next.add(localId)
        setUnticked(next)
    }
    const after = quota ? quota.used + selected.length : null
    const over = quota && after !== null && after > quota.limit

    const sync = async (): Promise<void> => {
        setBusy(true)
        try {
            await enable(selected.map((e) => e.localId))
        } finally {
            setBusy(false)
        }
    }

    return (
        <Modal
            size="sm"
            opened
            onClose={postpone}
            title="Sync your library to the cloud?"
            subtitle="Your saves follow you to every machine you sign in on."
            headerIcon={<CloudUpload />}
            footer={
                <div className="flex w-full flex-wrap justify-end gap-2">
                    <Button variant="ghost" disabled={busy} onClick={disable}>
                        Keep everything local
                    </Button>
                    <Button
                        variant="outline"
                        disabled={busy}
                        onClick={postpone}
                    >
                        Not now
                    </Button>
                    <Button disabled={busy} onClick={() => void sync()}>
                        {candidates.length
                            ? `Sync ${selected.length}`
                            : 'Turn on sync'}
                    </Button>
                </div>
            }
        >
            <div className="space-y-3">
                {quota && (
                    <p
                        className={
                            over
                                ? 'text-sm text-destructive'
                                : 'text-sm text-muted-foreground'
                        }
                    >
                        {after} / {quota.limit} cloud items on your plan
                        {over && ' — the rest stay on this device'}
                    </p>
                )}
                {candidates.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                        Nothing saved yet. New saves sync once this is on.
                    </p>
                ) : (
                    <ul className="max-h-72 space-y-1.5 overflow-y-auto">
                        {candidates.map((e) => (
                            <li
                                key={e.localId}
                                className="flex items-center gap-3 rounded-lg border border-border bg-background px-3 py-2"
                            >
                                <Checkbox
                                    id={`sync-${e.localId}`}
                                    checked={!unticked.has(e.localId)}
                                    onCheckedChange={(v) =>
                                        toggle(e.localId, v === true)
                                    }
                                />
                                <label
                                    htmlFor={`sync-${e.localId}`}
                                    className="min-w-0 flex-1 cursor-pointer"
                                >
                                    <span className="block truncate text-panel-title font-semibold">
                                        {e.name}
                                    </span>
                                    <span className="block text-xs text-muted-foreground">
                                        {summaryFacts(e.summary, e.updatedAt)}
                                    </span>
                                </label>
                            </li>
                        ))}
                    </ul>
                )}
                <p className="text-xs text-muted-foreground">
                    You can change this any time in Settings → Account.
                </p>
            </div>
        </Modal>
    )
}
