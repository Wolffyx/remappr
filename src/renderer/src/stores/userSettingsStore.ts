// pattern-check: skip — store schema migration to per-firmware scoping
import { create } from 'zustand'
import { createJSONStorage, devtools, persist } from 'zustand/middleware'

export type KeyDisplayMode = 'displayName' | 'binding' | 'hidden'
export type AdapterCategory = 'zmk' | 'qmk' | 'remappr'
export type CapStyle = 'flat' | 'sculpted' | 'mono' | 'glass'
export type ColorCodingMode = 'off' | 'subtle' | 'vivid'
export type WorkspaceMode = 'workbench' | 'inspector' | 'command'

const DEFAULT_FIRMWARE_KEY = '_default'

// pattern-check: skip — additive optional fields on existing settings interface
interface UserSettingsState {
    theme: 'dark' | 'light'
    autosave: boolean
    autoLoadLayout: boolean
    /** When on, a wiped-but-known keyboard is silently restored from its backup
     *  on reconnect instead of prompting. See profileBackupStore / restoreProfile. */
    autoRestoreProfile: boolean
    /** Transport id of the device flagged to auto-connect on launch, or null. */
    autoConnectDeviceId: string | null
    keyDisplayMode: Record<string, KeyDisplayMode>
    preferredAdapterCategory: AdapterCategory
    capStyle: CapStyle
    colorMode: ColorCodingMode
    workspace: WorkspaceMode
    seenBuilderTour: boolean
    setSeenBuilderTour: (seen: boolean) => void
    setCapStyle: (style: CapStyle) => void
    setColorMode: (mode: ColorCodingMode) => void
    setWorkspace: (workspace: WorkspaceMode) => void
    setTheme: (theme: 'dark' | 'light') => void
    setAutosave: (enabled: boolean) => void
    setAutoLoadLayout: (enabled: boolean) => void
    setAutoRestoreProfile: (enabled: boolean) => void
    setAutoConnectDeviceId: (id: string | null) => void
    setKeyDisplayMode: (
        firmware: string | undefined,
        mode: KeyDisplayMode,
    ) => void
    getKeyDisplayMode: (firmware: string | undefined) => KeyDisplayMode
    setPreferredAdapterCategory: (category: AdapterCategory) => void
}

const useUserSettingsStore = create<UserSettingsState>()(
    devtools(
        persist(
            (set, get) => ({
                theme: 'light',
                autosave: false,
                autoLoadLayout: false,
                autoRestoreProfile: false,
                autoConnectDeviceId: null,
                keyDisplayMode: {},
                preferredAdapterCategory: 'zmk',
                capStyle: 'sculpted',
                colorMode: 'subtle',
                workspace: 'workbench',
                seenBuilderTour: false,
                setSeenBuilderTour: (seenBuilderTour) =>
                    set({ seenBuilderTour }),
                setCapStyle: (capStyle) => set({ capStyle }),
                setColorMode: (colorMode) => set({ colorMode }),
                setWorkspace: (workspace) => set({ workspace }),
                setTheme: (theme) => set({ theme }),
                setAutosave: (enabled) => set({ autosave: enabled }),
                setAutoLoadLayout: (enabled) =>
                    set({ autoLoadLayout: enabled }),
                setAutoRestoreProfile: (enabled) =>
                    set({ autoRestoreProfile: enabled }),
                setAutoConnectDeviceId: (id) =>
                    set({ autoConnectDeviceId: id }),
                setKeyDisplayMode: (firmware, mode) =>
                    set((s) => ({
                        keyDisplayMode: {
                            ...s.keyDisplayMode,
                            [firmware ?? DEFAULT_FIRMWARE_KEY]: mode,
                        },
                    })),
                getKeyDisplayMode: (firmware) => {
                    const map = get().keyDisplayMode
                    return (
                        map[firmware ?? DEFAULT_FIRMWARE_KEY] ??
                        map[DEFAULT_FIRMWARE_KEY] ??
                        'displayName'
                    )
                },
                setPreferredAdapterCategory: (preferredAdapterCategory) =>
                    set({ preferredAdapterCategory }),
            }),
            {
                name: 'user-settings-store',
                storage: createJSONStorage(() => localStorage),
                version: 8,
                migrate: (persisted: unknown, version: number) => {
                    if (!persisted || typeof persisted !== 'object') {
                        return persisted as Partial<UserSettingsState>
                    }
                    const p = persisted as Record<string, unknown>
                    if (version < 2) {
                        const legacy = p.keyDisplayMode
                        if (typeof legacy === 'string') {
                            p.keyDisplayMode = {
                                [DEFAULT_FIRMWARE_KEY]:
                                    legacy as KeyDisplayMode,
                            }
                        } else if (!legacy || typeof legacy !== 'object') {
                            p.keyDisplayMode = {}
                        }
                    }
                    if (version < 3) {
                        const cat = p.preferredAdapterCategory
                        if (
                            cat !== 'zmk' &&
                            cat !== 'qmk' &&
                            cat !== 'remappr'
                        ) {
                            p.preferredAdapterCategory = 'zmk'
                        }
                    }
                    if (version < 4) {
                        const cap = p.capStyle
                        if (
                            cap !== 'flat' &&
                            cap !== 'sculpted' &&
                            cap !== 'mono' &&
                            cap !== 'glass'
                        ) {
                            p.capStyle = 'sculpted'
                        }
                        const cm = p.colorMode
                        if (cm !== 'off' && cm !== 'subtle' && cm !== 'vivid') {
                            p.colorMode = 'subtle'
                        }
                    }
                    if (version < 5) {
                        const ws = p.workspace
                        if (
                            ws !== 'workbench' &&
                            ws !== 'inspector' &&
                            ws !== 'command'
                        ) {
                            p.workspace = 'workbench'
                        }
                    }
                    if (version < 6) {
                        // Design refresh: the redesigned sculpted keycap is now the
                        // default. Move the old default ('flat') over; leave a
                        // deliberately-chosen mono/glass/sculpted alone.
                        if (p.capStyle === 'flat') {
                            p.capStyle = 'sculpted'
                        }
                    }
                    if (version < 7) {
                        // New first-run builder tour. Existing users have already
                        // explored the builder, so don't surface it to them.
                        if (typeof p.seenBuilderTour !== 'boolean') {
                            p.seenBuilderTour = true
                        }
                    }
                    if (version < 8) {
                        // Profile auto-restore + per-device auto-connect. Both
                        // default off / unset for existing users.
                        if (typeof p.autoRestoreProfile !== 'boolean') {
                            p.autoRestoreProfile = false
                        }
                        if (typeof p.autoConnectDeviceId !== 'string') {
                            p.autoConnectDeviceId = null
                        }
                    }
                    return p as Partial<UserSettingsState>
                },
            },
        ),
    ),
)

export default useUserSettingsStore
