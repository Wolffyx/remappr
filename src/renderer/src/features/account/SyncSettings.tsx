// Pattern check: no GoF pattern (-) — rejected — a settings block over
// syncStore; no logic of its own.
//
// Settings → Account → Library sync: the per-account choice, the plan's cloud
// usage, and a manual "Sync now".
import { useEffect } from 'react'
import { RefreshCw } from 'lucide-react'
import { Button } from '@/ui/button'
import { SwitchRow } from '@/ui/switch-row'
import useLibraryStore from '@/stores/libraryStore'
import useSyncStore from '@/stores/syncStore'

function lastSync(at: number | null): string {
    if (!at) return 'Not synced yet'
    return `Last synced ${new Date(at).toLocaleTimeString(undefined, {
        hour: '2-digit',
        minute: '2-digit',
    })}`
}

export function SyncSettings(): JSX.Element {
    const choice = useSyncStore((s) => s.choice)
    const status = useSyncStore((s) => s.status)
    const error = useSyncStore((s) => s.error)
    const lastSyncedAt = useSyncStore((s) => s.lastSyncedAt)
    const quota = useSyncStore((s) => s.quota)
    const enable = useSyncStore((s) => s.enable)
    const disable = useSyncStore((s) => s.disable)
    const syncNow = useSyncStore((s) => s.syncNow)
    const refreshQuota = useSyncStore((s) => s.refreshQuota)
    const on = choice === 'on'

    // Turning sync on here syncs everything saved, except entries the user
    // chose to keep on this device.
    const turnOn = (): void => {
        const ids = useLibraryStore
            .getState()
            .entries.filter((e) => !e.sync.localOnly)
            .map((e) => e.localId)
        void enable(ids)
    }

    useEffect(() => {
        void refreshQuota()
    }, [refreshQuota, lastSyncedAt])

    return (
        <div className="space-y-2 rounded-xl border bg-background p-4">
            <SwitchRow
                label="Sync my library"
                hint="Saved boards, layouts and keymaps follow you to every machine you sign in on."
                checked={on}
                onChange={(v) => (v ? turnOn() : disable())}
            />
            {quota && (
                <p className="text-xs text-muted-foreground">
                    {quota.used} / {quota.limit} cloud items on your plan
                </p>
            )}
            {on && (
                <div className="flex items-center gap-3">
                    <span
                        className={
                            status === 'error'
                                ? 'flex-1 text-xs text-destructive'
                                : 'flex-1 text-xs text-muted-foreground'
                        }
                    >
                        {status === 'error'
                            ? `Sync failed: ${error}`
                            : status === 'syncing'
                              ? 'Syncing…'
                              : lastSync(lastSyncedAt)}
                    </span>
                    <Button
                        size="sm"
                        variant="outline"
                        disabled={status === 'syncing'}
                        onClick={() => void syncNow()}
                    >
                        <RefreshCw className="size-3.5" /> Sync now
                    </Button>
                </div>
            )}
        </div>
    )
}
