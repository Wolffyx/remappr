// Pattern check: no GoF pattern (-) — rejected — one persisted view preference of the device editor (callout labels vs clean), same shape as stores/heatmapStore.ts.
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import type { StageLabels } from '../stage/DeviceStage'

interface DeviceViewState {
    labels: StageLabels
    setLabels: (labels: StageLabels) => void
}

/** How the device stage labels its controls; remembered across sessions. */
const useDeviceViewStore = create<DeviceViewState>()(
    persist(
        (set) => ({
            labels: 'callouts',
            setLabels: (labels) => set({ labels }),
        }),
        {
            name: 'device-view-store',
            storage: createJSONStorage(() => localStorage),
        },
    ),
)

export default useDeviceViewStore
