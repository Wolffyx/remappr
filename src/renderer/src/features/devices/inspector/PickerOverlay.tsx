// Pattern check: no GoF pattern (-) — rejected — connects the store's pick target to the device action picker and writes the picked action through the undoable mutations.
import type { JSX } from 'react'
import { bindingOf } from '@firmware/devices/defaults'
import { useBindingMutations } from '../model/bindingMutations'
import useDeviceEditorStore, {
    selectActiveBindings,
} from '../model/deviceEditorStore'
import { DeviceActionPicker } from './DeviceActionPicker'

/** The action picker over its container while a slot is being assigned. */
export function PickerOverlay(): JSX.Element | null {
    const pick = useDeviceEditorStore((s) => s.pick)
    const setPick = useDeviceEditorStore((s) => s.setPick)
    const loaded = useDeviceEditorStore((s) => s.loaded)
    const selected = useDeviceEditorStore((s) => s.selected)
    const bindings = useDeviceEditorStore(selectActiveBindings)
    const { patch } = useBindingMutations()
    const c = loaded?.model.controls.find((x) => x.id === selected)
    if (!pick || !loaded || !c) return null
    const current = bindingOf(
        c,
        bindings,
        loaded.index.catalog,
    ) as unknown as Record<string, unknown>
    return (
        <DeviceActionPicker
            key={pick.field + pick.title}
            title={pick.title}
            value={current[pick.field] as string | null | undefined}
            catalog={loaded.index.catalog}
            onPick={(id) => patch(c.id, { [pick.field]: id })}
            onClose={() => setPick(null)}
        />
    )
}
