// Pattern check: Dispatch Map (Tier 0) — applied — one table of editor tools (id → group, copy, icon, gate, action) that every toolbar style and the search palette render from.
//
// The editor's tools, written once. Every toolbar style (labelled, compact,
// group menus, expanding groups, search-in-bar, pinned + launcher) and the
// header search palette read this table, so a tool lives in exactly one group
// with one name and one description wherever it appears.
//
// What differs per tool at runtime — is it available on this firmware, is it
// on, what does a click do — is resolved in `useEditorTools`, which owns the
// store subscriptions so the toolbar components stay presentational.
import { useEffect, useMemo } from 'react'
import {
    BarChart3,
    Download,
    Flame,
    Gauge,
    Languages,
    Layers,
    Lightbulb,
    Network,
    ScanLine,
    Sliders,
    SlidersHorizontal,
    SpellCheck,
    Timer,
    Wifi,
    Zap,
    type LucideIcon,
} from 'lucide-react'

import { supportsRuntimeLighting } from '@firmware/config'
import {
    FEATURE_PROBES,
    type Feature,
} from '@/features/firmware/useFeatureAvailable'
import useConnectionStore from '@/stores/connectionStore'
import useConfigStore from '@/stores/configStore'
import useHeatmapStore from '@/stores/heatmapStore'
import useLiveViewStore from '@/stores/liveViewStore'
import useKeyTestStore from '@/stores/keyTestStore'
import useLoadStatsStore from '@/stores/loadStatsStore'
import useRgbSheetStore from '@/stores/rgbSheetStore'
import useAdvancedSheetStore from '@/stores/advancedSheetStore'
import useToolDialogStore from '@/stores/toolDialogStore'

export type ToolGroupId =
    | 'view'
    | 'behaviors'
    | 'lighting'
    | 'device'
    | 'firmware'

export const TOOL_GROUPS: readonly { id: ToolGroupId; label: string }[] = [
    { id: 'view', label: 'View' },
    { id: 'behaviors', label: 'Behaviors' },
    { id: 'lighting', label: 'Lighting' },
    { id: 'device', label: 'Device' },
    { id: 'firmware', label: 'Firmware' },
]

/** What a click does. Each kind is resolved against its store in
 *  `useEditorTools`; dialogs open by tool id through toolDialogStore. */
type ToolAction =
    | 'heatmap'
    | 'live'
    | 'key-test'
    | 'load'
    | 'dynamic'
    | 'lighting'
    | 'dialog'

export interface ToolDef {
    id: string
    group: ToolGroupId
    /** Button and menu label. */
    label: string
    /** Short form for the labelled bar, where width is tight. */
    short?: string
    /** One line on what the tool does — menus, launcher and search. */
    description: string
    icon: LucideIcon
    /** Capability the connected firmware must expose for the tool to show;
     *  with a list, any one of them. */
    feature?: Feature | readonly Feature[]
    action: ToolAction
}

// Declaration order is toolbar order within a group.
export const TOOLS: readonly ToolDef[] = [
    {
        id: 'heatmap',
        group: 'view',
        label: 'Heatmap',
        description: 'Colour keys by how often you press them',
        icon: Flame,
        action: 'heatmap',
    },
    {
        id: 'live',
        group: 'view',
        label: 'Live view',
        short: 'Live',
        description: 'Light up keys as you type',
        icon: Zap,
        action: 'live',
    },
    {
        id: 'key-test',
        group: 'view',
        label: 'Key test',
        description: 'Check that every switch registers',
        icon: ScanLine,
        feature: 'keyTest',
        action: 'key-test',
    },
    {
        id: 'load',
        group: 'view',
        label: 'Typing load',
        short: 'Load',
        description: 'Finger and hand balance stats',
        icon: BarChart3,
        action: 'load',
    },
    {
        id: 'dynamic',
        group: 'behaviors',
        label: 'Dynamic entries',
        short: 'Dynamic',
        description: 'Tap dance, combos, key overrides, alt-repeat and macros',
        icon: Sliders,
        feature: ['dynamic', 'macros'],
        action: 'dynamic',
    },
    {
        id: 'behaviors',
        group: 'behaviors',
        label: 'Behaviors',
        description: 'Hold-tap, sticky keys and other behavior settings',
        icon: SlidersHorizontal,
        feature: 'limits',
        action: 'dialog',
    },
    {
        id: 'conditional-layers',
        group: 'behaviors',
        label: 'Conditional layers',
        short: 'Cond. layers',
        description: 'Two layers together turn on a third',
        icon: Layers,
        feature: 'limits',
        action: 'dialog',
    },
    {
        id: 'autocorrect',
        group: 'behaviors',
        label: 'Autocorrect',
        description: 'Fix typos as you type',
        icon: SpellCheck,
        feature: 'limits',
        action: 'dialog',
    },
    {
        id: 'unicode',
        group: 'behaviors',
        label: 'Unicode input',
        short: 'Unicode',
        description: 'How symbols are typed on your computer',
        icon: Languages,
        feature: 'unicode',
        action: 'dialog',
    },
    {
        id: 'lighting',
        group: 'lighting',
        label: 'Lighting',
        description: 'RGB effects and per-key colour',
        icon: Lightbulb,
        action: 'lighting',
    },
    {
        id: 'timing',
        group: 'device',
        label: 'Timing and defaults',
        short: 'Timing',
        description: 'Tapping term, debounce and other defaults',
        icon: Timer,
        feature: 'limits',
        action: 'dialog',
    },
    {
        id: 'wireless',
        group: 'device',
        label: 'Wireless',
        description: 'Bluetooth profiles and power',
        icon: Wifi,
        feature: 'wireless',
        action: 'dialog',
    },
    {
        id: 'cluster',
        group: 'device',
        label: 'Cluster',
        description: 'Node status, role and the link between nodes',
        icon: Network,
        feature: ['cluster', 'limits'],
        action: 'dialog',
    },
    {
        id: 'advanced',
        group: 'device',
        label: 'Advanced',
        description: 'Low-level firmware options',
        icon: Gauge,
        feature: 'advanced',
        action: 'dialog',
    },
    {
        id: 'export',
        group: 'firmware',
        label: 'Export and build',
        short: 'Export',
        description: 'Download a buildable firmware project',
        icon: Download,
        action: 'dialog',
    },
]

/** A tool resolved against the connected device and the editor's state. */
export interface EditorTool extends ToolDef {
    active: boolean
    disabled: boolean
    /** Why it is disabled, when it is. */
    reason?: string
    run: () => void
}

export interface EditorToolGroup {
    id: ToolGroupId
    label: string
    tools: EditorTool[]
}

/** Every tool the connected device can use, resolved, plus the same list
 *  grouped. Tools whose capability is missing are left out, not greyed. */
export function useEditorTools(): {
    tools: EditorTool[]
    groups: EditorToolGroup[]
} {
    const service = useConnectionStore((s) => s.service)
    const heatmap = useHeatmapStore((s) => s.enabled)
    const toggleHeatmap = useHeatmapStore((s) => s.toggle)
    const live = useLiveViewStore((s) => s.enabled)
    const toggleLive = useLiveViewStore((s) => s.toggle)
    const keyTest = useKeyTestStore((s) => s.active)
    const toggleKeyTest = useKeyTestStore((s) => s.toggle)
    const openLoad = useLoadStatsStore((s) => s.setOpen)
    const rgbOpen = useRgbSheetStore((s) => s.open)
    const toggleRgb = useRgbSheetStore((s) => s.toggle)
    const setRgbOpen = useRgbSheetStore((s) => s.setOpen)
    const advOpen = useAdvancedSheetStore((s) => s.open)
    const advSection = useAdvancedSheetStore((s) => s.section)
    const openAdv = useAdvancedSheetStore((s) => s.openAt)
    const setAdvOpen = useAdvancedSheetStore((s) => s.setOpen)
    const dialog = useToolDialogStore((s) => s.open)
    const openDialog = useToolDialogStore((s) => s.openDialog)
    const rgbUnsupported = useConfigStore((s) => {
        const target = s.config?.meta.target
        return target ? !supportsRuntimeLighting(target) : false
    })

    return useMemo(() => {
        // Pattern check: Dispatch Map (Tier 0) — applied — action kind → (active, run).
        const actions: Record<
            ToolAction,
            (t: ToolDef) => [boolean, () => void]
        > = {
            heatmap: () => [heatmap, toggleHeatmap],
            live: () => [live, toggleLive],
            'key-test': () => [keyTest, toggleKeyTest],
            load: () => [false, (): void => openLoad(true)],
            // One entry for the dock; it reopens on the last tab used.
            dynamic: () => [
                advOpen,
                (): void => {
                    if (advOpen) return setAdvOpen(false)
                    setRgbOpen(false)
                    openAdv(advSection)
                },
            ],
            lighting: () => [
                rgbOpen,
                (): void => {
                    setAdvOpen(false)
                    toggleRgb()
                },
            ],
            dialog: (t) => [dialog === t.id, (): void => openDialog(t.id)],
        }
        const has = (f: Feature): boolean =>
            !!service && !!FEATURE_PROBES[f](service)
        const available = ({ feature }: ToolDef): boolean =>
            !feature ||
            (typeof feature === 'string' ? has(feature) : feature.some(has))

        const tools = TOOLS.filter(available).map((t): EditorTool => {
            const [active, run] = actions[t.action](t)
            const noLighting = t.action === 'lighting' && rgbUnsupported
            return {
                ...t,
                active,
                run,
                disabled: !service || noLighting,
                reason: noLighting
                    ? 'RGB lighting is compile-time only on this firmware'
                    : undefined,
            }
        })
        const groups = TOOL_GROUPS.map((g) => ({
            ...g,
            tools: tools.filter((t) => t.group === g.id),
        }))
        return { tools, groups }
    }, [
        service,
        heatmap,
        toggleHeatmap,
        live,
        toggleLive,
        keyTest,
        toggleKeyTest,
        openLoad,
        rgbOpen,
        toggleRgb,
        setRgbOpen,
        advOpen,
        advSection,
        openAdv,
        setAdvOpen,
        dialog,
        openDialog,
        rgbUnsupported,
    ])
}

/** Side effects the old header clusters owned: a tool that disappears while
 *  on (reconnect to a firmware without it) is switched off. Mounted once. */
export function useToolHousekeeping(): void {
    const service = useConnectionStore((s) => s.service)
    const keyTestOn = useKeyTestStore((s) => s.active)
    const setKeyTestActive = useKeyTestStore((s) => s.setActive)
    const rgbOpen = useRgbSheetStore((s) => s.open)
    const setRgbOpen = useRgbSheetStore((s) => s.setOpen)
    const rgbUnsupported = useConfigStore((s) => {
        const target = s.config?.meta.target
        return target ? !supportsRuntimeLighting(target) : false
    })
    const keyTestAvailable = !!service && !!FEATURE_PROBES.keyTest(service)

    useEffect(() => {
        if (!keyTestAvailable && keyTestOn) setKeyTestActive(false)
    }, [keyTestAvailable, keyTestOn, setKeyTestActive])
    useEffect(() => {
        if (rgbUnsupported && rgbOpen) setRgbOpen(false)
    }, [rgbUnsupported, rgbOpen, setRgbOpen])
}
