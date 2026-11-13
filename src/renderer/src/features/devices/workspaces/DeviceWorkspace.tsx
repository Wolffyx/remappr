// Pattern check: Dispatch Map (Tier 0) — applied — workspace setting → device-editor layout table (B right dock, A bottom sheet, C command card + palette), mirroring the keymap editor's three workspaces.
import { useEffect, type JSX } from 'react'
import { X } from 'lucide-react'
import useUserSettingsStore, {
    type WorkspaceMode,
} from '@/stores/userSettingsStore'
import { profileAccent } from '@/lib/devices/deviceCategory'
import { cn } from '@/lib/cn'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/ui/tooltip'
import { DeviceWorkbench } from '../DeviceWorkbench'
import { DeviceCommandPalette } from '../inspector/DeviceCommandPalette'
import { InspectorPanel } from '../inspector/InspectorPanel'
import { PickerOverlay } from '../inspector/PickerOverlay'
import useDeviceEditorStore from '../model/deviceEditorStore'
import { useCommandAssign } from '../model/useCommandAssign'
import { DOCK_WIDTH, InspectorDock } from './InspectorDock'
import { SelectedInfoBar } from './SelectedInfoBar'

/** B · Inspector: a persistent right dock. */
function InspectorWorkspace(): JSX.Element {
    return (
        <DeviceWorkbench dockWidth={DOCK_WIDTH}>
            <InspectorDock />
        </DeviceWorkbench>
    )
}

/** A · Workbench: selecting a control raises a bottom sheet with its settings. */
function SheetWorkspace(): JSX.Element {
    const selected = useDeviceEditorStore((s) => s.selected)
    const panelOpen = useDeviceEditorStore((s) => s.panelOpen)
    const select = useDeviceEditorStore((s) => s.select)
    const setPanelOpen = useDeviceEditorStore((s) => s.setPanelOpen)
    const sheetUp = panelOpen && !!selected
    const onSelect = (id: string | null): void => {
        select(id)
        if (id) setPanelOpen(true)
    }
    return (
        <DeviceWorkbench
            onSelect={onSelect}
            stageBottom={sheetUp ? '46%' : '0'}
            stageInset={sheetUp ? 'inset-[56px_0_12px]' : undefined}
        >
            <SelectedInfoBar onEdit={() => setPanelOpen(true)} />
            {sheetUp && (
                <div className="absolute inset-x-0 bottom-0 z-[80] flex h-[46%] flex-col overflow-hidden rounded-t-2xl border-t border-border bg-popover shadow-[0_-20px_50px_-20px_rgba(0,0,0,.6)] animate-in slide-in-from-bottom-4">
                    <div className="flex justify-center pt-[7px]">
                        <span className="h-1 w-[38px] rounded-full bg-border" />
                    </div>
                    <div className="flex-1 overflow-x-hidden overflow-y-auto">
                        <InspectorPanel
                            wide
                            onClose={() => setPanelOpen(false)}
                        />
                    </div>
                    <PickerOverlay />
                </div>
            )}
        </DeviceWorkbench>
    )
}

/** Thin vertical colour bars, one per profile, on the stage's left edge. */
function ProfileColorRail(): JSX.Element {
    const profiles = useDeviceEditorStore((s) => s.profiles)
    const activeId = useDeviceEditorStore((s) => s.activeProfileId)
    const show = useDeviceEditorStore((s) => s.showProfile)
    return (
        <div className="absolute top-1/2 left-4 z-[15] flex -translate-y-1/2 flex-col gap-2">
            {profiles.map((p, i) => {
                const on = p.id === activeId
                const accent = profileAccent(i)
                return (
                    <Tooltip key={p.id}>
                        <TooltipTrigger asChild>
                            <button
                                type="button"
                                aria-label={`${p.name} profile`}
                                onClick={() => void show(p.id)}
                                className={cn(
                                    'w-2.5 rounded-full p-0 transition-all',
                                    on ? 'h-[30px]' : 'h-2.5 opacity-50',
                                )}
                                style={{
                                    background: accent,
                                    boxShadow: on
                                        ? `0 0 10px ${accent}`
                                        : 'none',
                                }}
                            />
                        </TooltipTrigger>
                        <TooltipContent side="right">
                            <p>{p.name}</p>
                        </TooltipContent>
                    </Tooltip>
                )
            })}
        </div>
    )
}

/** C · Command: minimal chrome — a floating settings card and a ⌘K palette. */
function CommandWorkspace(): JSX.Element {
    const selected = useDeviceEditorStore((s) => s.selected)
    const panelOpen = useDeviceEditorStore((s) => s.panelOpen)
    const pick = useDeviceEditorStore((s) => s.pick)
    const select = useDeviceEditorStore((s) => s.select)
    const setPanelOpen = useDeviceEditorStore((s) => s.setPanelOpen)
    const assign = useCommandAssign()
    const onSelect = (id: string | null): void => {
        select(id)
        if (id) assign()
    }
    return (
        <DeviceWorkbench
            onSelect={onSelect}
            hint={
                <>
                    Click a control · <span className="font-mono">⌘K</span> to
                    assign
                </>
            }
        >
            <ProfileColorRail />
            <SelectedInfoBar indent onEdit={assign} />
            {panelOpen && selected && !pick && (
                <div
                    role="presentation"
                    onPointerDown={() => setPanelOpen(false)}
                    className="absolute inset-0 z-[85] flex items-start justify-center pt-[8vh]"
                >
                    <div
                        role="presentation"
                        onPointerDown={(e) => e.stopPropagation()}
                        className="flex max-h-[78%] w-[min(400px,92%)] flex-col overflow-hidden rounded-xl border border-border bg-popover shadow-[0_30px_70px_-20px_rgba(0,0,0,.7)] animate-in fade-in zoom-in-95"
                    >
                        <div className="flex-1 overflow-x-hidden overflow-y-auto">
                            <InspectorPanel
                                onClose={() => setPanelOpen(false)}
                            />
                        </div>
                        <div className="flex items-center gap-3.5 border-t border-border px-4 py-[9px] text-caption text-muted-foreground">
                            <span>click an action to open the palette</span>
                            <span className="ml-auto inline-flex items-center gap-1">
                                <X className="size-3" />{' '}
                                <b className="font-mono">esc</b> close
                            </span>
                        </div>
                    </div>
                </div>
            )}
            <DeviceCommandPalette />
        </DeviceWorkbench>
    )
}

const WORKSPACES: Readonly<Record<WorkspaceMode, () => JSX.Element>> = {
    inspector: InspectorWorkspace,
    workbench: SheetWorkspace,
    command: CommandWorkspace,
}

/** The device editor's stage area, laid out per the Workspace setting. */
export function DeviceWorkspace(): JSX.Element {
    const workspace = useUserSettingsStore((s) => s.workspace)
    // A panel or pick opened in one layout means nothing in the next.
    useEffect(() => {
        const s = useDeviceEditorStore.getState()
        s.setPanelOpen(false)
        s.setPick(null)
    }, [workspace])
    const Layout = WORKSPACES[workspace]
    return <Layout />
}
