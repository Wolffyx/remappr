// Pattern check: no GoF pattern (-) — rejected — workspace B layout: a persistent right dock showing the control list or the selected control's inspector.
import type { JSX } from 'react'
import { ControlList } from '../inspector/ControlList'
import { InspectorPanel } from '../inspector/InspectorPanel'
import { PickerOverlay } from '../inspector/PickerOverlay'
import useDeviceEditorStore from '../model/deviceEditorStore'

export const DOCK_WIDTH = 326

/** Workspace B ("Inspector"): the right dock is always there. */
export function InspectorDock(): JSX.Element {
    const selected = useDeviceEditorStore((s) => s.selected)
    const select = useDeviceEditorStore((s) => s.select)
    return (
        <aside
            className="absolute inset-y-0 right-0 z-[80] flex flex-col overflow-hidden border-l border-border bg-card"
            style={{ width: DOCK_WIDTH }}
        >
            <div className="flex-1 overflow-x-hidden overflow-y-auto">
                {selected ? (
                    <InspectorPanel onClose={() => select(null)} />
                ) : (
                    <ControlList />
                )}
            </div>
            <PickerOverlay />
        </aside>
    )
}
