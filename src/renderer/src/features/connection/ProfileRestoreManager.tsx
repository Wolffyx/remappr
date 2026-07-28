// Pattern check: no GoF pattern (-) — rejected — headless effect component
// (backup capture + wipe detection) plus a controlled prompt modal; no abstraction.
import { useCallback, useEffect, useState } from 'react'
import { RotateCcw } from 'lucide-react'
import { Modal } from '@/ui/modal'
import { Button } from '@/ui/button'
import useConnectionStore from '@/stores/connectionStore'
import useUserSettingsStore from '@/stores/userSettingsStore'
import useProfileBackupStore, {
    backupKey,
    buildBackup,
    keymapHash,
    type ProfileBackup,
} from '@/stores/profileBackupStore'
import { applyRestore } from './applyRestore'
import type { KeyboardService } from '@firmware/service'

interface RestorePrompt {
    backup: ProfileBackup
    key: string
    /** Live hash that triggered the prompt — stored on "don't ask" so the same
     *  wiped state stays silent while a later change re-arms detection. */
    liveHash: string
}

function supportsBackup(service: KeyboardService): boolean {
    return (
        !!service.capabilities.profileRestore && !service.capabilities.readOnly
    )
}

/**
 * Headless manager for per-device profile backup + restore. Mounted in the
 * editor shell (like DevicePreviewCapture): captures a backup on connect and
 * after every successful save, and — when a known device reconnects with a
 * diverged/wiped keymap — either silently restores (auto-restore setting on) or
 * prompts the user. Firmware-neutral; only devices whose adapter sets
 * `capabilities.profileRestore` reach any of this.
 */
export function ProfileRestoreManager(): JSX.Element {
    const service = useConnectionStore((s) => s.service)
    const saveBackup = useProfileBackupStore((s) => s.saveBackup)
    const setDismissedHash = useProfileBackupStore((s) => s.setDismissedHash)

    const [prompt, setPrompt] = useState<RestorePrompt | null>(null)
    const [restoring, setRestoring] = useState(false)

    // pattern-check: skip — delegates restore side-effects to shared applyRestore
    const doRestore = useCallback(
        async (
            svc: KeyboardService,
            backup: ProfileBackup,
            key: string,
        ): Promise<void> => {
            setRestoring(true)
            try {
                await applyRestore(svc, backup, key)
            } finally {
                setRestoring(false)
            }
        },
        [],
    )

    // Detection + baseline capture, once per connected editable device.
    useEffect(() => {
        if (!service || !supportsBackup(service)) return
        const svc = service
        const key = backupKey(
            svc,
            useConnectionStore.getState().lastConnectedDevice?.id,
        )
        let cancelled = false

        void (async () => {
            let live
            try {
                live = await svc.getKeymap()
            } catch {
                return
            }
            if (cancelled) return
            const liveHash = keymapHash(live)
            const existing = useProfileBackupStore.getState().backups[key]

            if (!existing) {
                saveBackup(key, buildBackup(svc, live, Date.now()))
                return
            }
            // In sync, or the user already dismissed this exact state.
            if (existing.hash === liveHash) return
            if (existing.dismissedHash === liveHash) return

            if (useUserSettingsStore.getState().autoRestoreProfile) {
                await doRestore(svc, existing, key)
                return
            }
            setPrompt({ backup: existing, key, liveHash })
        })()

        return (): void => {
            cancelled = true
        }
    }, [service, saveBackup, doRestore])

    // Re-capture after every successful commit (pending true → false).
    useEffect(() => {
        if (!service || !supportsBackup(service)) return
        const svc = service
        const key = backupKey(
            svc,
            useConnectionStore.getState().lastConnectedDevice?.id,
        )
        let prevPending = svc.hasPendingChanges()
        return svc.onPendingChangesChanged((pending) => {
            const wasPending = prevPending
            prevPending = pending
            if (wasPending && !pending) {
                svc.getKeymap()
                    .then((km) =>
                        saveBackup(key, buildBackup(svc, km, Date.now())),
                    )
                    .catch(() => {})
            }
        })
    }, [service, saveBackup])

    const savedAt = prompt
        ? new Date(prompt.backup.savedAt).toLocaleString()
        : ''

    return (
        <Modal
            opened={!!prompt}
            onClose={(): void => setPrompt(null)}
            title="Restore your layout?"
            subtitle={prompt ? `Last backed up ${savedAt}` : undefined}
            headerIcon={<RotateCcw />}
            customModalBoxClass="w-11/12 max-w-lg"
            footer={
                <div className="flex flex-wrap justify-end gap-2">
                    <Button
                        variant="ghost"
                        disabled={restoring}
                        onClick={(): void => {
                            if (prompt)
                                setDismissedHash(prompt.key, prompt.liveHash)
                            setPrompt(null)
                        }}
                    >
                        Don&apos;t ask for this device
                    </Button>
                    <Button
                        variant="outline"
                        disabled={restoring}
                        onClick={(): void => setPrompt(null)}
                    >
                        Keep current
                    </Button>
                    <Button
                        disabled={restoring || !service}
                        onClick={(): void => {
                            if (!prompt || !service) return
                            const p = prompt
                            setPrompt(null)
                            void doRestore(service, p.backup, p.key)
                        }}
                    >
                        Restore
                    </Button>
                </div>
            }
        >
            <p className="py-2 text-sm text-muted-foreground">
                This keyboard&apos;s current layout differs from your saved
                backup
                {prompt
                    ? ` (${prompt.backup.keymap.layers.length} layers)`
                    : ''}{' '}
                — it may have been reset or wiped. Restoring overwrites the
                keyboard&apos;s current layout with your backup and saves it to
                the device.
            </p>
        </Modal>
    )
}
