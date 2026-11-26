// Pattern check: no GoF pattern (-) — rejected — lifecycle hook: load the device into the editor store on mount, follow its outside changes, reset on unmount.
import { useEffect } from 'react'
import type { ControlsApi } from '@firmware/service'
import useDeviceEditorStore from './deviceEditorStore'

/** Keep the device editor store on `controls`: load it, reload what changed
 *  outside this client (discard, reset, an on-device profile switch), and
 *  clear the store when the editor goes away. */
export function useDeviceControls(controls: ControlsApi): void {
    useEffect(() => {
        const store = useDeviceEditorStore.getState()
        void store.load(controls)
        const off = controls.onChanged((change) => {
            void useDeviceEditorStore.getState().applyChange(change)
        })
        return () => {
            off()
            useDeviceEditorStore.getState().reset()
        }
    }, [controls])
}
