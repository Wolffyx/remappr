// Pattern check: no GoF pattern (-) — rejected — one hook: the assign flow of workspace C (buttons go to the palette, other controls to their settings card).
import { useFeatureAvailable } from '@/features/firmware/useFeatureAvailable'
import useDeviceEditorStore from './deviceEditorStore'

/** Opens the assign flow for the selected control: a button goes straight to
 *  the palette, anything else to its settings card. */
export function useCommandAssign(): () => void {
    const editable = useFeatureAvailable('controlsEditable')
    return () => {
        const s = useDeviceEditorStore.getState()
        const c = s.loaded?.model.controls.find((x) => x.id === s.selected)
        if (!c) return
        if (c.kind === 'button' && editable) {
            s.setPick({ field: 'a', title: `${c.name} · tap` })
            return
        }
        s.setPanelOpen(true)
    }
}
