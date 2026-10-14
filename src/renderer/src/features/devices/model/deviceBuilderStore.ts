// Pattern check: no GoF pattern (-) — rejected — zustand slice for the Builder's device layout mode (working layout, selection, snapshot history), same shape as stores/builderStore.ts.
//
// The device layout the Builder is editing — a new device design, or the
// connected device being re-drawn ("Fix layout") — with its own undo history
// (whole-layout snapshots, like the keyboard builder's).
import { toast } from 'sonner'
import { create } from 'zustand'
import { connectMockDeviceWithModel } from '@firmware'
import type { DeviceModel } from '@firmware/devices/types'
import useBuilderStore from '@/stores/builderStore'
import useConnectionStore from '@/stores/connectionStore'

/** 'new': a design started in the Builder · 'device': the connected device's
 *  layout being fixed (applied back to it, not opened as a demo). */
export type LayoutOrigin = 'new' | 'device'

const HISTORY_CAP = 60

interface DeviceBuilderState {
    layout: DeviceModel | null
    origin: LayoutOrigin
    selected: string | null
    past: DeviceModel[]
    future: DeviceModel[]
    /** The layout when a drag began; pushed to history once it moves. */
    gesture: DeviceModel | null

    start: (layout: DeviceModel, origin: LayoutOrigin) => void
    select: (id: string | null) => void
    commit: (next: DeviceModel) => void
    beginGesture: () => void
    live: (next: DeviceModel) => void
    endGesture: () => void
    undo: () => void
    redo: () => void
    openInEditor: () => void
    applyToDevice: () => Promise<void>
}

const push = (stack: DeviceModel[], m: DeviceModel): DeviceModel[] =>
    [...stack, m].slice(-HISTORY_CAP)

const useDeviceBuilderStore = create<DeviceBuilderState>()((set, get) => ({
    layout: null,
    origin: 'new',
    selected: null,
    past: [],
    future: [],
    gesture: null,

    start: (layout, origin) =>
        set({
            layout,
            origin,
            selected: null,
            past: [],
            future: [],
            gesture: null,
        }),
    select: (selected) => set({ selected }),
    commit: (next) => {
        const cur = get().layout
        set((s) => ({
            layout: next,
            past: cur ? push(s.past, cur) : s.past,
            future: [],
            gesture: null,
        }))
    },
    beginGesture: () => set((s) => ({ gesture: s.gesture ?? s.layout })),
    live: (next) => {
        const { gesture } = get()
        set((s) => ({
            layout: next,
            // The first move of a drag records where it started.
            past: gesture ? push(s.past, gesture) : s.past,
            future: gesture ? [] : s.future,
            gesture: null,
        }))
    },
    endGesture: () => set({ gesture: null }),
    undo: () => {
        const { past, layout } = get()
        const prev = past.at(-1)
        if (!prev || !layout) return
        set((s) => ({
            layout: prev,
            past: s.past.slice(0, -1),
            future: [layout, ...s.future],
        }))
    },
    redo: () => {
        const { future, layout } = get()
        const next = future[0]
        if (!next || !layout) return
        set((s) => ({
            layout: next,
            past: push(s.past, layout),
            future: s.future.slice(1),
        }))
    },

    openInEditor: () => {
        const { layout } = get()
        if (!layout) return
        const service = connectMockDeviceWithModel(layout)
        const conn = useConnectionStore.getState()
        service.onClosed(() => {
            useConnectionStore.getState().setDeviceName(null)
            useConnectionStore.getState().setService(null)
        })
        conn.setDeviceName(service.deviceInfo.name)
        conn.setService(service)
        // Keep the builder workspace so "Back to Builder" restores it.
        useBuilderStore.setState({ open: false, cameFromBuilder: true })
    },

    applyToDevice: async () => {
        const { layout } = get()
        const controls = useConnectionStore.getState().service?.controls
        if (!layout || !controls?.layout) return
        try {
            await controls.layout.apply(layout)
            useBuilderStore.setState({ open: false })
            toast.success('Layout applied to the device')
        } catch (e) {
            toast.error('This layout does not fit the device', {
                description: e instanceof Error ? e.message : String(e),
            })
        }
    },
}))

export default useDeviceBuilderStore
