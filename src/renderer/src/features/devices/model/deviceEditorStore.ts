// Pattern check: no GoF pattern (-) — rejected — zustand slice for the device editor (loaded model, catalog, profiles, per-profile bindings, selection); same store shape as stores/keymapStore.ts.
//
// What the device editor shows: the connected device's model, catalog,
// profiles and per-profile bindings, plus the editor's own selection state.
// Loads go through store actions guarded by a token, so a late reply from a
// device that was already swapped out is dropped.
import { create } from 'zustand'
import type { ControlsApi } from '@firmware/service'
import type {
    ControlBinding,
    ControlsChange,
    DeviceBindings,
    DeviceModel,
    DeviceProfile,
} from '@firmware/devices/types'
import { indexCatalog, type CatalogIndex } from '@/lib/devices/bindingSummary'

/** Where an action picked from the picker / palette goes. */
export interface PickTarget {
    /** Binding field the picked action is written to (a, hold, cw …). */
    field: string
    title: string
}

interface Loaded {
    model: DeviceModel
    index: CatalogIndex
}

interface DeviceEditorState {
    controls: ControlsApi | null
    status: 'idle' | 'loading' | 'ready' | 'error'
    error: string | null
    loaded: Loaded | null
    profiles: readonly DeviceProfile[]
    activeProfileId: string | null
    bindings: Readonly<Record<string, DeviceBindings>>
    selected: string | null
    pick: PickTarget | null
    /** Workspace A sheet / C card open for the selected control. */
    panelOpen: boolean

    load: (controls: ControlsApi) => Promise<void>
    applyChange: (change: ControlsChange) => Promise<void>
    reset: () => void
    putBinding: (
        profileId: string,
        controlId: string,
        b: ControlBinding,
    ) => void
    showProfile: (profileId: string) => Promise<void>
    addProfile: (name: string) => Promise<void>
    renameProfile: (profileId: string, name: string) => Promise<void>
    select: (id: string | null) => void
    setPick: (pick: PickTarget | null) => void
    setPanelOpen: (open: boolean) => void
}

const INITIAL = {
    controls: null,
    status: 'idle' as const,
    error: null,
    loaded: null,
    profiles: [],
    activeProfileId: null,
    bindings: {},
    selected: null,
    pick: null,
    panelOpen: false,
}

const message = (e: unknown): string =>
    e instanceof Error ? e.message : String(e)

const useDeviceEditorStore = create<DeviceEditorState>()((set, get) => {
    /** Run `fn` only if `controls` is still the loaded device afterwards. */
    const current = (controls: ControlsApi): boolean =>
        get().controls === controls

    const fetchBindings = async (
        controls: ControlsApi,
        profileId: string,
    ): Promise<void> => {
        const b = await controls.getBindings(profileId)
        if (!current(controls)) return
        set((s) => ({ bindings: { ...s.bindings, [profileId]: b } }))
    }

    const fetchProfiles = async (controls: ControlsApi): Promise<void> => {
        const { profiles, activeId } = await controls.getProfiles()
        if (!current(controls)) return
        const keep = get().activeProfileId
        const active = profiles.some((p) => p.id === keep) ? keep! : activeId
        set({ profiles, activeProfileId: active, bindings: {} })
        await fetchBindings(controls, active)
    }

    // One reload per kind of outside change.
    const ON_CHANGE: {
        [T in ControlsChange['type']]: (
            controls: ControlsApi,
            change: Extract<ControlsChange, { type: T }>,
        ) => Promise<void>
    } = {
        model: (controls) => get().load(controls),
        profiles: (controls) => fetchProfiles(controls),
        bindings: (controls, change) =>
            fetchBindings(controls, change.profileId),
    }
    const onChange = (
        controls: ControlsApi,
        change: ControlsChange,
    ): Promise<void> =>
        (
            ON_CHANGE[change.type] as (
                c: ControlsApi,
                ch: ControlsChange,
            ) => Promise<void>
        )(controls, change)

    return {
        ...INITIAL,

        load: async (controls) => {
            set({ ...INITIAL, controls, status: 'loading' })
            try {
                const [model, catalog] = await Promise.all([
                    controls.getModel(),
                    controls.getCatalog(),
                ])
                if (!current(controls)) return
                set({ loaded: { model, index: indexCatalog(catalog) } })
                await fetchProfiles(controls)
                if (current(controls)) set({ status: 'ready' })
            } catch (e) {
                if (current(controls))
                    set({ status: 'error', error: message(e) })
            }
        },

        applyChange: async (change) => {
            const controls = get().controls
            if (!controls) return
            await onChange(controls, change)
        },

        reset: () => set(INITIAL),

        putBinding: (profileId, controlId, b) =>
            set((s) => ({
                bindings: {
                    ...s.bindings,
                    [profileId]: { ...s.bindings[profileId], [controlId]: b },
                },
            })),

        showProfile: async (profileId) => {
            const controls = get().controls
            if (!controls) return
            set({
                activeProfileId: profileId,
                selected: null,
                pick: null,
                panelOpen: false,
            })
            await controls.selectProfile?.(profileId)
            if (!get().bindings[profileId])
                await fetchBindings(controls, profileId)
        },

        addProfile: async (name) => {
            const controls = get().controls
            if (!controls?.addProfile) return
            const profile = await controls.addProfile(name)
            if (!current(controls)) return
            set((s) => ({ profiles: [...s.profiles, profile] }))
            await get().showProfile(profile.id)
        },

        renameProfile: async (profileId, name) => {
            const controls = get().controls
            if (!controls?.renameProfile) return
            await controls.renameProfile(profileId, name)
            if (!current(controls)) return
            set((s) => ({
                profiles: s.profiles.map((p) =>
                    p.id === profileId ? { ...p, name } : p,
                ),
            }))
        },

        select: (id) => set({ selected: id, pick: null, panelOpen: false }),
        setPick: (pick) => set({ pick }),
        setPanelOpen: (panelOpen) => set({ panelOpen }),
    }
})

const EMPTY_BINDINGS: DeviceBindings = {}

/** The active profile's bindings (empty while loading). */
export const selectActiveBindings = (s: DeviceEditorState): DeviceBindings =>
    (s.activeProfileId && s.bindings[s.activeProfileId]) || EMPTY_BINDINGS

export default useDeviceEditorStore
