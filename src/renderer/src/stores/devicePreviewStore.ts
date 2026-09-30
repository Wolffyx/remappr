// Pattern check: no GoF pattern (-) — rejected — persisted zustand snapshot map mirroring
// heatmapStore; serializable per-device layout cache, no abstraction.
import { create } from 'zustand'
import { createJSONStorage, devtools, persist } from 'zustand/middleware'
import type { KeyCategory } from '@/lib/keymap/keyCategory'

/** One key of a cached base-layer preview — fully serializable (no ReactNodes).
 *  Shape and colour category only: the card shows the board, never what the
 *  keys are bound to. */
export interface PreviewKey {
    x: number
    y: number
    width: number
    height: number
    r?: number
    rx?: number
    ry?: number
    category: KeyCategory
}

/** A knob's position, in keyboard units like PreviewKey. */
export interface PreviewEncoder {
    x: number
    y: number
}

/**
 * A snapshot of a device's base layer, captured while connected and shown on its
 * start-page card after disconnect. Keyed by the device's stable list id (falling
 * back to the firmware-reported name for pair-new flows that have no list id).
 */
export interface DevicePreviewSnapshot {
    name: string
    communication: 'serial' | 'ble' | 'hid'
    keyCount: number
    layerCount: number
    keys: PreviewKey[]
    encoders?: PreviewEncoder[]
    savedAt: number
}

interface DevicePreviewState {
    snapshots: Record<string, DevicePreviewSnapshot>
    saveSnapshot: (key: string, snapshot: DevicePreviewSnapshot) => void
    clear: (key: string) => void
}

// Keeps only a key's shape and category, whatever else an older snapshot saved.
const stripLegend = ({
    x,
    y,
    width,
    height,
    r,
    rx,
    ry,
    category,
}: PreviewKey): PreviewKey => ({ x, y, width, height, r, rx, ry, category })

/** Persist migration. v1: snapshots no longer carry key legends
 *  (tap/hold/action); strip the ones saved before. */
export function migrateDevicePreviews(
    persisted: unknown,
    version: number,
): Partial<DevicePreviewState> {
    const p = (persisted ?? {}) as Partial<DevicePreviewState>
    if (version >= 1 || !p.snapshots) return p
    const snapshots = Object.fromEntries(
        Object.entries(p.snapshots).map(([id, snap]) => [
            id,
            { ...snap, keys: snap.keys.map(stripLegend) },
        ]),
    )
    return { ...p, snapshots }
}

const useDevicePreviewStore = create<DevicePreviewState>()(
    devtools(
        persist(
            (set) => ({
                snapshots: {},
                saveSnapshot: (key, snapshot) =>
                    set((s) => ({
                        snapshots: { ...s.snapshots, [key]: snapshot },
                    })),
                clear: (key) =>
                    set((s) => {
                        const next = { ...s.snapshots }
                        delete next[key]
                        return { snapshots: next }
                    }),
            }),
            {
                name: 'device-preview-store',
                storage: createJSONStorage(() => localStorage),
                partialize: (s) => ({ snapshots: s.snapshots }),
                version: 1,
                migrate: migrateDevicePreviews,
            },
        ),
    ),
)

export default useDevicePreviewStore
