// Pattern check: no GoF pattern (-) — rejected — composition root of the device editor: shared editor chrome (sidebar, header) around the device workbench.
//
// The editor for a device driven as controls (mouse, gamepad, flight stick,
// generic HID). Same chrome as the keymap editor: the sidebar, the header with
// its own tool clusters, and the workbench.
import type { JSX } from 'react'
import { Keyboard } from 'lucide-react'
import type { ControlsApi } from '@firmware/service'
import { SidebarInset, SidebarProvider } from '@/ui/sidebar'
import { ErrorBoundary } from '@/ui/ErrorBoundary'
import { Header } from '@/layout/Header'
import { SIDEBAR_STYLE } from '@/layout/sidebarStyle'
import { DeviceDrawer } from './DeviceDrawer'
import { DeviceToolClusters } from './DeviceToolClusters'
import { DeviceWorkbench } from './DeviceWorkbench'
import { FORM_ICON } from './formIcons'
import useDeviceEditorStore from './model/deviceEditorStore'
import { useDeviceControls } from './model/useDeviceControls'
import { DOCK_WIDTH, InspectorDock } from './workspaces/InspectorDock'

export function DeviceEditor({
    controls,
}: {
    controls: ControlsApi
}): JSX.Element {
    useDeviceControls(controls)
    const form = useDeviceEditorStore((s) => s.loaded?.model.form)
    return (
        <SidebarProvider className="!min-h-0 h-full" style={SIDEBAR_STYLE}>
            <DeviceDrawer />
            <SidebarInset>
                <Header
                    icon={form ? FORM_ICON[form] : Keyboard}
                    tools={<DeviceToolClusters />}
                />
                <ErrorBoundary>
                    <DeviceWorkbench dockWidth={DOCK_WIDTH}>
                        <InspectorDock />
                    </DeviceWorkbench>
                </ErrorBoundary>
            </SidebarInset>
        </SidebarProvider>
    )
}
