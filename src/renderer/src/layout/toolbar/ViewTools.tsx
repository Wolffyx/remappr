// pattern-check: skip — toolbar cluster extracted from Header, no abstraction
//
// The view cluster: heatmap · live view · key test · typing-load stats. Owns its
// own store subscriptions, so toggling the heatmap re-renders these four buttons
// instead of the whole header.
import { lazy, useEffect } from 'react'
import { BarChart3, Flame, ScanLine, Zap } from 'lucide-react'

import { MountOnDemand } from '@/components/MountOnDemand'
import useHeatmapStore from '@/stores/heatmapStore'
import useLiveViewStore from '@/stores/liveViewStore'
import useKeyTestStore from '@/stores/keyTestStore'
import useLoadStatsStore from '@/stores/loadStatsStore'
import { useFeatureAvailable } from '@/features/firmware/useFeatureAvailable'
import { ToolbarButton } from './ToolbarButton'

// Click-gated dialog — kept out of the editor's first-paint chunk.
const LoadStatsModal = lazy(() =>
    import('@/features/keymap/keyboard/LoadStatsModal').then((m) => ({
        default: m.LoadStatsModal,
    })),
)

export function ViewTools(): JSX.Element {
    const heatmapOn = useHeatmapStore((s) => s.enabled)
    const toggleHeatmap = useHeatmapStore((s) => s.toggle)
    const liveOn = useLiveViewStore((s) => s.enabled)
    const toggleLive = useLiveViewStore((s) => s.toggle)
    const keyTestOn = useKeyTestStore((s) => s.active)
    const toggleKeyTest = useKeyTestStore((s) => s.toggle)
    const setKeyTestActive = useKeyTestStore((s) => s.setActive)
    const loadOpen = useLoadStatsStore((s) => s.open)
    const setLoadOpen = useLoadStatsStore((s) => s.setOpen)

    // Key test is gated on the hardware switch-matrix facade; if it vanishes
    // (e.g. reconnecting to a firmware without it) force the mode off, since the
    // toggle button is hidden and the overlay would otherwise stick on.
    const keyTestAvailable = useFeatureAvailable('keyTest')
    useEffect(() => {
        if (!keyTestAvailable && keyTestOn) setKeyTestActive(false)
    }, [keyTestAvailable, keyTestOn, setKeyTestActive])

    return (
        <>
            <ToolbarButton
                icon={Flame}
                tooltip="Heatmap"
                label="Heatmap"
                active={heatmapOn}
                onClick={toggleHeatmap}
            />
            <ToolbarButton
                icon={Zap}
                tooltip="Live view"
                label="Live view"
                active={liveOn}
                onClick={toggleLive}
            />
            {/* Key test reads the hardware switch matrix (service.keyTest);
                without that facade it'd silently fall back to OS events and
                duplicate Live view, so gate it on the capability. */}
            <ToolbarButton
                feature="keyTest"
                icon={ScanLine}
                tooltip="Key test"
                label="Key test"
                active={keyTestOn}
                onClick={toggleKeyTest}
            />
            <ToolbarButton
                icon={BarChart3}
                tooltip="Typing load stats"
                label="Typing load"
                onClick={(): void => setLoadOpen(true)}
            />
            <MountOnDemand when={loadOpen}>
                <LoadStatsModal
                    opened={loadOpen}
                    onClose={(): void => setLoadOpen(false)}
                />
            </MountOnDemand>
        </>
    )
}
