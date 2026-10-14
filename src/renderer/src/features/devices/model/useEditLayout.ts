// Pattern check: no GoF pattern (-) — rejected — one hook: the "re-draw this device in the Builder" action, or null when the device or the builder cannot.
import { useCallback } from 'react'
import { useBuilderAccess } from '@/hooks/use-premium'
import useBuilderStore from '@/stores/builderStore'
import useConnectionStore from '@/stores/connectionStore'
import useDeviceBuilderStore from './deviceBuilderStore'
import useDeviceEditorStore from './deviceEditorStore'

/** Open the connected device's layout in the Builder (to fix or refine it and
 *  apply it back), or null when the device's layout is fixed or the builder is
 *  not available. */
export function useEditLayout(): (() => void) | null {
    const canLayout = useConnectionStore((s) => !!s.service?.controls?.layout)
    const access = useBuilderAccess()
    const edit = useCallback(() => {
        const model = useDeviceEditorStore.getState().loaded?.model
        if (!model) return
        useDeviceBuilderStore.getState().start(model, 'device')
        useBuilderStore.getState().openDevice()
    }, [])
    return canLayout && access ? edit : null
}
