// pattern-check: skip — descriptor table + render loop over existing wrappers
//
// The header's capability-gated dialogs. Every one of them is the same thing:
// a gated icon button that flips a boolean, and a dialog mounted on first open.
// Spelling that out per dialog meant ten `useState`s, ten five-line `lazy()`
// wrappers and ten near-identical 23-line JSX blocks in Header — ~290 lines
// where the only real differences were an icon, two strings and a capability.
//
// So the differences live in a table and the shape is written once. The
// toolbar's tool table (tools.tsx) points at these by id and ToolDialogs mounts
// them; adding a dialog is one entry here and one tool there.
import { lazy, type ComponentType, type LazyExoticComponent } from 'react'
import {
    Gauge,
    Languages,
    Layers,
    Network,
    SlidersHorizontal,
    SpellCheck,
    Timer,
    Waypoints,
    Wifi,
    type LucideIcon,
} from 'lucide-react'

import type { Feature } from '@/features/firmware/useFeatureAvailable'

/** The props every toolbar dialog takes. */
interface ModalProps {
    opened: boolean
    onClose: () => void
}

type LazyModal = LazyExoticComponent<ComponentType<ModalProps>>

/**
 * `lazy()` over a NAMED export. React's `lazy` insists on a module shaped like
 * `{ default }`, which is why each dialog previously carried its own
 * `.then((m) => ({ default: m.Thing }))` wrapper. Hand it the picked component
 * instead — same code-splitting, one line, still fully typed.
 */
const lazyModal = (load: () => Promise<ComponentType<ModalProps>>): LazyModal =>
    lazy(async () => ({ default: await load() }))

export interface ToolbarModalSpec {
    id: string
    /** Capability the connected firmware must expose for the button to show. */
    feature: Feature
    icon: LucideIcon
    /** Tooltip text. */
    tooltip: string
    /** Button aria-label — the longer, more descriptive form. */
    label: string
    Modal: LazyModal
}

// The tool table (tools.tsx) decides order and grouping; this one only maps
// a dialog id to its lazily loaded component and capability.
export const TOOLBAR_MODALS: readonly ToolbarModalSpec[] = [
    {
        id: 'wireless',
        feature: 'wireless',
        icon: Wifi,
        tooltip: 'Wireless',
        label: 'Wireless settings',
        Modal: lazyModal(() =>
            import('@/features/firmware/WirelessSettingsModal').then(
                (m) => m.WirelessSettingsModal,
            ),
        ),
    },
    {
        id: 'cluster',
        feature: 'cluster',
        icon: Network,
        tooltip: 'Cluster',
        label: 'Cluster diagnostics',
        Modal: lazyModal(() =>
            import('@/features/firmware/ClusterDiagnosticsModal').then(
                (m) => m.ClusterDiagnosticsModal,
            ),
        ),
    },
    {
        id: 'unicode',
        feature: 'unicode',
        icon: Languages,
        tooltip: 'Unicode input',
        label: 'Unicode input method',
        Modal: lazyModal(() =>
            import('@/features/firmware/UnicodeInputModal').then(
                (m) => m.UnicodeInputModal,
            ),
        ),
    },
    {
        id: 'advanced',
        feature: 'advanced',
        icon: Gauge,
        tooltip: 'Advanced Mode',
        label: 'Advanced settings',
        Modal: lazyModal(() =>
            import('@/features/firmware/AdvancedSettingsModal').then(
                (m) => m.AdvancedSettingsModal,
            ),
        ),
    },
    {
        id: 'timing',
        feature: 'limits',
        icon: Timer,
        tooltip: 'Timing & Defaults',
        label: 'Timing & defaults',
        Modal: lazyModal(() =>
            import('@/features/firmware/TimingDefaultsModal').then(
                (m) => m.TimingDefaultsModal,
            ),
        ),
    },
    {
        id: 'behaviors',
        feature: 'limits',
        icon: SlidersHorizontal,
        tooltip: 'Behaviors',
        label: 'Behaviors',
        Modal: lazyModal(() =>
            import('@/features/firmware/BehaviorDefsModal').then(
                (m) => m.BehaviorDefsModal,
            ),
        ),
    },
    {
        id: 'conditional-layers',
        feature: 'limits',
        icon: Layers,
        tooltip: 'Conditional Layers',
        label: 'Conditional layers',
        Modal: lazyModal(() =>
            import('@/features/firmware/ConditionalLayersModal').then(
                (m) => m.ConditionalLayersModal,
            ),
        ),
    },
    {
        id: 'autocorrect',
        feature: 'limits',
        icon: SpellCheck,
        tooltip: 'Autocorrect',
        label: 'Autocorrect',
        Modal: lazyModal(() =>
            import('@/features/firmware/AutocorrectModal').then(
                (m) => m.AutocorrectModal,
            ),
        ),
    },
    {
        id: 'node-config',
        feature: 'limits',
        icon: Waypoints,
        tooltip: 'Node & Cluster',
        label: 'Node & cluster',
        Modal: lazyModal(() =>
            import('@/features/firmware/NodeConfigModal').then(
                (m) => m.NodeConfigModal,
            ),
        ),
    },
    {
        id: 'link-profile',
        feature: 'limits',
        icon: Gauge,
        tooltip: 'Link Profile',
        label: 'Link profile',
        Modal: lazyModal(() =>
            import('@/features/firmware/LinkProfileModal').then(
                (m) => m.LinkProfileModal,
            ),
        ),
    },
]
