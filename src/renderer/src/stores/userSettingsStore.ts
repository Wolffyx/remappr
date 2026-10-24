// pattern-check: skip — store schema migration to per-firmware scoping
import { create } from 'zustand'
import { createJSONStorage, devtools, persist } from 'zustand/middleware'

export type KeyDisplayMode = 'displayName' | 'binding' | 'hidden'
/** A firmware-family id declared by an adapter (FirmwareAdapter.category).
 *  Open by design — the set is whatever is registered, so adding a firmware
 *  needs no change here. `null` = the user hasn't chosen; the UI then falls
 *  back to the first registered family (see lib/adapterCategories). */
export type AdapterCategory = string
export type CapStyle = 'flat' | 'sculpted' | 'mono' | 'glass'
export type ColorCodingMode = 'off' | 'subtle' | 'vivid'
export type WorkspaceMode = 'workbench' | 'inspector' | 'command'
/** How the start page shows news; see features/news. */
export const NEWS_STYLES = [
    'feed',
    'rail',
    'spotlight',
    'banner',
    'chip',
    'inbox',
    'none',
] as const
export type NewsStyle = (typeof NEWS_STYLES)[number]
/** How the editor's floating toolbar lays out its tools; see
 *  layout/toolbar/FloatingToolbar. */
export const TOOLBAR_STYLES = [
    'labelled',
    'compact',
    'groups',
    'expand',
    'search',
    'pinned',
] as const
export type ToolbarStyle = (typeof TOOLBAR_STYLES)[number]
/** How the editor sidebar shows the other devices: a card with an icon strip,
 *  or a rail of device icons beside the panel. See features/sidebar. */
export type SidebarStyle = 'card' | 'rail'
/** Physical layouts as one select menu, or as a list of rows. */
export type LayoutPickerStyle = 'select' | 'list'
/** Layers in a scrolling list with the legend folded, or all rows with the
 *  legend open. */
export type LayerListStyle = 'scroll' | 'full'
/** How many devices the "last used" list remembers. */
const RECENT_DEVICES_MAX = 20
/** Tools on the bar in the 'pinned' style, by tool id (layout/toolbar/tools). */
export const DEFAULT_PINNED_TOOLS = ['heatmap', 'live', 'dynamic', 'lighting']

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
    preferredAdapterCategory: AdapterCategory | null
    capStyle: CapStyle
    colorMode: ColorCodingMode
    workspace: WorkspaceMode
    newsStyle: NewsStyle
    /** Show the pinned-news banner on top of whichever layout is picked. */
    newsPinnedBanner: boolean
    toolbarStyle: ToolbarStyle
    pinnedTools: string[]
    sidebarStyle: SidebarStyle
    /** Card style: switch to the rail once more devices are reachable than
     *  the card's strip shows. */
    sidebarAutoRail: boolean
    /** In the rail style, fold the panel away; layers sit on the rail. */
    sidebarFoldToRail: boolean
    layoutPicker: LayoutPickerStyle
    layerList: LayerListStyle
    /** Roster keys (features/sidebar/roster) kept at the front of the strip. */
    pinnedDevices: string[]
    /** Roster keys, most recently opened first. */
    recentDevices: string[]
    seenBuilderTour: boolean
    /** Version of the last launch; a newer one on start opens "what's new".
     *  null until the first launch records it. */
    lastRunVersion: string | null
    setLastRunVersion: (version: string) => void
    setSeenBuilderTour: (seen: boolean) => void
    setCapStyle: (style: CapStyle) => void
    setColorMode: (mode: ColorCodingMode) => void
    setWorkspace: (workspace: WorkspaceMode) => void
    setNewsStyle: (style: NewsStyle) => void
    setNewsPinnedBanner: (enabled: boolean) => void
    setToolbarStyle: (style: ToolbarStyle) => void
    togglePinnedTool: (id: string) => void
    setSidebarStyle: (style: SidebarStyle) => void
    setSidebarAutoRail: (enabled: boolean) => void
    setSidebarFoldToRail: (enabled: boolean) => void
    setLayoutPicker: (style: LayoutPickerStyle) => void
    setLayerList: (style: LayerListStyle) => void
    togglePinnedDevice: (key: string) => void
    markDeviceUsed: (key: string) => void
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
    setPreferredAdapterCategory: (category: AdapterCategory | null) => void
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
                preferredAdapterCategory: null,
                capStyle: 'sculpted',
                colorMode: 'subtle',
                workspace: 'workbench',
                newsStyle: 'rail',
                newsPinnedBanner: false,
                toolbarStyle: 'labelled',
                pinnedTools: DEFAULT_PINNED_TOOLS,
                sidebarStyle: 'card',
                sidebarAutoRail: true,
                sidebarFoldToRail: false,
                layoutPicker: 'select',
                layerList: 'scroll',
                pinnedDevices: [],
                recentDevices: [],
                seenBuilderTour: false,
                lastRunVersion: null,
                setLastRunVersion: (lastRunVersion) => set({ lastRunVersion }),
                setSeenBuilderTour: (seenBuilderTour) =>
                    set({ seenBuilderTour }),
                setCapStyle: (capStyle) => set({ capStyle }),
                setColorMode: (colorMode) => set({ colorMode }),
                setWorkspace: (workspace) => set({ workspace }),
                setNewsStyle: (newsStyle) => set({ newsStyle }),
                setNewsPinnedBanner: (newsPinnedBanner) =>
                    set({ newsPinnedBanner }),
                setToolbarStyle: (toolbarStyle) => set({ toolbarStyle }),
                togglePinnedTool: (id) =>
                    set((s) => ({
                        pinnedTools: s.pinnedTools.includes(id)
                            ? s.pinnedTools.filter((t) => t !== id)
                            : [...s.pinnedTools, id],
                    })),
                setSidebarStyle: (sidebarStyle) => set({ sidebarStyle }),
                setSidebarAutoRail: (sidebarAutoRail) =>
                    set({ sidebarAutoRail }),
                setSidebarFoldToRail: (sidebarFoldToRail) =>
                    set({ sidebarFoldToRail }),
                setLayoutPicker: (layoutPicker) => set({ layoutPicker }),
                setLayerList: (layerList) => set({ layerList }),
                togglePinnedDevice: (key) =>
                    set((s) => ({
                        pinnedDevices: s.pinnedDevices.includes(key)
                            ? s.pinnedDevices.filter((k) => k !== key)
                            : [...s.pinnedDevices, key],
                    })),
                markDeviceUsed: (key) =>
                    set((s) => ({
                        recentDevices: [
                            key,
                            ...s.recentDevices.filter((k) => k !== key),
                        ].slice(0, RECENT_DEVICES_MAX),
                    })),
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
                version: 11,
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
                        // Historical cleanup: v<3 could hold junk here. The
                        // literals are the families that existed AT THAT TIME —
                        // a migration describes the past and is frozen, so this
                        // is not a live firmware-name dependency. Anything else
                        // becomes null: "not chosen", resolved against the live
                        // registry on read.
                        const cat = p.preferredAdapterCategory
                        if (
                            cat !== 'zmk' &&
                            cat !== 'qmk' &&
                            cat !== 'remappr'
                        ) {
                            p.preferredAdapterCategory = null
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
                    if (version < 9) {
                        // Start-page news layouts. Everyone starts on the rail.
                        const style = p.newsStyle
                        if (!NEWS_STYLES.includes(style as NewsStyle)) {
                            p.newsStyle = 'rail'
                        }
                        if (typeof p.newsPinnedBanner !== 'boolean') {
                            p.newsPinnedBanner = false
                        }
                    }
                    if (version < 10) {
                        // Floating toolbar. Everyone starts on the labelled bar.
                        const style = p.toolbarStyle
                        if (!TOOLBAR_STYLES.includes(style as ToolbarStyle)) {
                            p.toolbarStyle = 'labelled'
                        }
                        if (!Array.isArray(p.pinnedTools)) {
                            p.pinnedTools = DEFAULT_PINNED_TOOLS
                        }
                    }
                    if (version < 11) {
                        // f13: tap dance + macros became one "dynamic" tool, and
                        // the three cluster dialogs one "cluster" tool.
                        const merged: Record<string, string> = {
                            'tap-dance': 'dynamic',
                            macros: 'dynamic',
                            'node-config': 'cluster',
                            'link-profile': 'cluster',
                        }
                        if (Array.isArray(p.pinnedTools)) {
                            p.pinnedTools = [
                                ...new Set(
                                    (p.pinnedTools as string[]).map(
                                        (id) => merged[id] ?? id,
                                    ),
                                ),
                            ]
                        }
                    }
                    return p as Partial<UserSettingsState>
                },
            },
        ),
    ),
)

export default useUserSettingsStore
