// pattern-check: skip — descriptor table + render loop over existing wrappers
//
// The header's capability-gated dialogs. Every one of them is the same thing:
// a gated icon button that flips a boolean, and a dialog mounted on first open.
// Spelling that out per dialog meant ten `useState`s, ten five-line `lazy()`
// wrappers and ten near-identical 23-line JSX blocks in Header — ~290 lines
// where the only real differences were an icon, two strings and a capability.
//
// So the differences live in a table and the shape is written once. Adding a
// dialog is one entry; nothing in Header changes.
import {
    lazy,
    useState,
    type ComponentType,
    type LazyExoticComponent,
} from 'react'
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

import { Button } from '@/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/ui/tooltip'
import { MountOnDemand } from '@/components/MountOnDemand'
import { FeatureGate } from '@/features/firmware/FeatureGate'
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

interface ToolbarModalSpec {
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

// Declaration order IS toolbar order.
const TOOLBAR_MODALS: readonly ToolbarModalSpec[] = [
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

function ToolbarModalButton({
    spec,
    disabled,
}: {
    spec: ToolbarModalSpec
    disabled: boolean
}): JSX.Element {
    // Open state lives per dialog rather than in Header: a `setXOpen(true)` up
    // there re-rendered the entire toolbar just to show one dialog.
    const [open, setOpen] = useState(false)
    const { icon: Icon, Modal } = spec

    return (
        <>
            <FeatureGate feature={spec.feature}>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button
                            variant="ghost"
                            size="icon"
                            disabled={disabled}
                            onClick={(): void => setOpen(true)}
                        >
                            <Icon aria-label={spec.label} />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>{spec.tooltip}</p>
                    </TooltipContent>
                </Tooltip>
            </FeatureGate>
            {/* Deliberately OUTSIDE the gate, as it was before: a capability
                that drops away while the dialog is open (a reconnect to a
                firmware without it) must not tear the dialog out mid-edit. */}
            <MountOnDemand when={open}>
                <Modal opened={open} onClose={(): void => setOpen(false)} />
            </MountOnDemand>
        </>
    )
}

/** Every capability-gated toolbar dialog, in order. */
export function ToolbarModals({
    disabled,
}: {
    disabled: boolean
}): JSX.Element {
    return (
        <>
            {TOOLBAR_MODALS.map((spec) => (
                <ToolbarModalButton
                    key={spec.id}
                    spec={spec}
                    disabled={disabled}
                />
            ))}
        </>
    )
}
