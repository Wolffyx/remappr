// pattern-check: skip — id → lazily loaded dialog table
//
// The toolbar's dialogs, by tool id. The tool table (tools.tsx) owns each
// tool's name, icon, group and capability; this table only says which dialog a
// tool opens, loaded on first open. ToolDialogs mounts them once.
import { lazy, type ComponentType, type LazyExoticComponent } from 'react'

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
    Modal: LazyModal
}

export const TOOLBAR_MODALS: readonly ToolbarModalSpec[] = [
    {
        id: 'wireless',
        Modal: lazyModal(() =>
            import('@/features/firmware/WirelessSettingsModal').then(
                (m) => m.WirelessSettingsModal,
            ),
        ),
    },
    {
        id: 'power',
        Modal: lazyModal(() =>
            import('@/features/firmware/PowerSettingsModal').then(
                (m) => m.PowerSettingsModal,
            ),
        ),
    },
    {
        id: 'cluster',
        Modal: lazyModal(() =>
            import('@/features/firmware/ClusterModal').then(
                (m) => m.ClusterModal,
            ),
        ),
    },
    {
        id: 'unicode',
        Modal: lazyModal(() =>
            import('@/features/firmware/UnicodeInputModal').then(
                (m) => m.UnicodeInputModal,
            ),
        ),
    },
    {
        id: 'advanced',
        Modal: lazyModal(() =>
            import('@/features/firmware/AdvancedSettingsModal').then(
                (m) => m.AdvancedSettingsModal,
            ),
        ),
    },
    {
        id: 'timing',
        Modal: lazyModal(() =>
            import('@/features/firmware/TimingDefaultsModal').then(
                (m) => m.TimingDefaultsModal,
            ),
        ),
    },
    {
        id: 'behaviors',
        Modal: lazyModal(() =>
            import('@/features/firmware/BehaviorDefsModal').then(
                (m) => m.BehaviorDefsModal,
            ),
        ),
    },
    {
        id: 'conditional-layers',
        Modal: lazyModal(() =>
            import('@/features/firmware/ConditionalLayersModal').then(
                (m) => m.ConditionalLayersModal,
            ),
        ),
    },
    {
        id: 'autocorrect',
        Modal: lazyModal(() =>
            import('@/features/firmware/AutocorrectModal').then(
                (m) => m.AutocorrectModal,
            ),
        ),
    },
]
