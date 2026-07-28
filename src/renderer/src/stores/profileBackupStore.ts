// Pattern check: no GoF pattern (-) — rejected — persisted zustand snapshot map
// mirroring devicePreviewStore; serializable per-device keymap backup, no abstraction.
import { create } from 'zustand'
import { createJSONStorage, devtools, persist } from 'zustand/middleware'
import type { KeyboardService } from '@firmware/service'
import type { Keymap } from '@firmware/types'

/**
 * A restorable snapshot of one keyboard's full keymap, kept in localStorage and
 * keyed by the device's durable hardware serial (which survives an NVS wipe, so
 * a reset keyboard still matches its backup on reconnect).
 */
// pattern-check: skip — additive optional identity fields on existing interface
export interface ProfileBackup {
    deviceName: string
    firmware: string
    /** Hardware serial the backup key was derived from, when the device reported
     *  one. Stored in the value (not just as the map key) so a future account/sync
     *  layer can match a keyboard across hosts and tell portable backups apart
     *  from host-local ones. Undefined when the device reports no serial. */
    serialNumber?: string
    /** USB vendor/product ids, when known — extra signal for cross-host matching. */
    vid?: number
    pid?: number
    /** Neutral keymap (layers + bindings); restores directly via setKeys. */
    keymap: Keymap
    /** Content signature of {@link keymap} — stable across layer-id reassignment
     *  (hashes names + bindings, not ids), used for wipe/divergence detection. */
    hash: string
    /** When set, the user chose "don't ask" for a device whose live keymap hashed
     *  to this value — suppresses the restore prompt until the live state changes. */
    dismissedHash?: string
    savedAt: number
}

interface ProfileBackupState {
    backups: Record<string, ProfileBackup>
    saveBackup: (key: string, backup: ProfileBackup) => void
    setDismissedHash: (key: string, hash: string) => void
    clear: (key: string) => void
}

const useProfileBackupStore = create<ProfileBackupState>()(
    devtools(
        persist(
            (set) => ({
                backups: {},
                saveBackup: (key, backup) =>
                    set((s) => ({
                        backups: { ...s.backups, [key]: backup },
                    })),
                setDismissedHash: (key, hash) =>
                    set((s) => {
                        const existing = s.backups[key]
                        if (!existing) return s
                        return {
                            backups: {
                                ...s.backups,
                                [key]: { ...existing, dismissedHash: hash },
                            },
                        }
                    }),
                clear: (key) =>
                    set((s) => {
                        const next = { ...s.backups }
                        delete next[key]
                        return { backups: next }
                    }),
            }),
            {
                name: 'profile-backup-store',
                storage: createJSONStorage(() => localStorage),
                partialize: (s) => ({ backups: s.backups }),
            },
        ),
    ),
)

export default useProfileBackupStore

/**
 * Stable localStorage key for a device's backup. Prefers the hardware serial
 * (survives an NVS wipe), falling back to the transport id then the reported
 * name — mirrors devicePreviewStore's key derivation.
 */
export function backupKey(
    service: KeyboardService,
    lastConnectedId?: string | null,
): string {
    return (
        service.deviceInfo.serialNumber ||
        lastConnectedId ||
        service.deviceInfo.name ||
        'unknown-device'
    )
}

/**
 * Content signature of a keymap that ignores layer ids (which the firmware
 * reassigns after a wipe or layer add/remove) so a faithful restore hashes equal
 * to its backup. Covers layer names + every binding's {kind, params} + the active
 * physical layout. Encoders are intentionally excluded — v1 restores key bindings
 * only, so hashing them would falsely re-trigger detection after a restore.
 */
export function keymapHash(keymap: Keymap): string {
    const canonical = JSON.stringify({
        activeLayoutId: keymap.activeLayoutId,
        layers: keymap.layers.map((l) => ({
            name: l.name,
            keys: l.keys.map((k) => [k.kind, k.params]),
        })),
    })
    // djb2 → base36; a short stable string is all detection needs.
    let h = 5381
    for (let i = 0; i < canonical.length; i++) {
        h = ((h << 5) + h + canonical.charCodeAt(i)) | 0
    }
    return (h >>> 0).toString(36)
}

/** Assemble a ProfileBackup from a live keymap read. */
export function buildBackup(
    service: KeyboardService,
    keymap: Keymap,
    savedAt: number,
): ProfileBackup {
    return {
        deviceName: service.deviceInfo.name || 'Keyboard',
        firmware: service.deviceInfo.firmware,
        serialNumber: service.deviceInfo.serialNumber,
        vid: service.deviceInfo.vid,
        pid: service.deviceInfo.pid,
        keymap,
        hash: keymapHash(keymap),
        savedAt,
    }
}

/**
 * Whether a backup's map key is portable across hosts — i.e. derived from the
 * device's hardware serial (`backupKey`'s first branch) rather than a
 * host-specific transport id / name fallback. A future account/sync layer should
 * only sync portable backups; host-local ones must be re-keyed on the next local
 * connect. Note: portability ≠ uniqueness — identical boards with a fixed/blank
 * firmware serial can still collide on the same key.
 */
export function isPortableKey(key: string, backup: ProfileBackup): boolean {
    return !!backup.serialNumber && key === backup.serialNumber
}
