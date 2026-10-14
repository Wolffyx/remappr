// Pattern check: no GoF pattern (-) — rejected — the device editor's toolbar composed from the shared ToolbarButton / ToolbarSlot / HistoryTools primitives.
import { Download, Ruler, Zap } from 'lucide-react'
import { toast } from 'sonner'
import { Separator } from '@/ui/separator'
import { Settings } from '@/components/modals/Settings'
import { downloadExports } from '@/lib/blob'
import useConnectionStore from '@/stores/connectionStore'
import useLiveViewStore from '@/stores/liveViewStore'
import { HistoryTools } from '@/layout/toolbar/HistoryTools'
import { ToolbarButton, ToolbarSlot } from '@/layout/toolbar/ToolbarButton'
import { DeviceSettingsButton } from './DeviceSettings'
import { useEditLayout } from './model/useEditLayout'

const SEPARATOR = 'mx-1 data-[orientation=vertical]:h-5'

async function exportProfiles(): Promise<void> {
    const service = useConnectionStore.getState().service
    if (!service) return
    try {
        downloadExports(await service.exportConfig())
    } catch (e) {
        toast.error('Could not export the profiles', {
            description: e instanceof Error ? e.message : String(e),
        })
    }
}

/** Live view · export · settings | undo · redo · save. */
export function DeviceToolClusters(): JSX.Element {
    const liveOn = useLiveViewStore((s) => s.enabled)
    const toggleLive = useLiveViewStore((s) => s.toggle)
    const editLayout = useEditLayout()
    const canExport = useConnectionStore(
        (s) => !!s.service?.capabilities.exportFormats.length,
    )
    return (
        <>
            <ToolbarButton
                icon={Zap}
                tooltip="Live view"
                label="Live view"
                active={liveOn}
                onClick={toggleLive}
                feature="controlsLive"
            />
            <Separator orientation="vertical" className={SEPARATOR} />
            {canExport && (
                <ToolbarButton
                    icon={Download}
                    tooltip="Export profiles"
                    label="Export profiles"
                    onClick={() => void exportProfiles()}
                />
            )}
            {editLayout && (
                <ToolbarButton
                    icon={Ruler}
                    tooltip="Edit layout in the Builder"
                    label="Edit layout"
                    onClick={editLayout}
                />
            )}
            <DeviceSettingsButton />
            <ToolbarSlot tooltip="Settings">
                <Settings />
            </ToolbarSlot>
            <Separator orientation="vertical" className={SEPARATOR} />
            <HistoryTools />
        </>
    )
}
