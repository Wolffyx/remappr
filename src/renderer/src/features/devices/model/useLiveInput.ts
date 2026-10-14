// Pattern check: Observer (Tier 1) — extended — subscribes to the ControlsApi.onInput observer and forwards frames into liveInputStore, at most one per animation frame.
import { useEffect } from 'react'
import type { ControlInputFrame } from '@firmware/devices/types'
import type { ControlsApi } from '@firmware/service'
import useLiveInputStore from './liveInputStore'

/** While `enabled`, feed the device's live input into the live-input store.
 *  Frames arriving faster than the display are coalesced to the latest one. */
export function useLiveInput(controls: ControlsApi, enabled: boolean): void {
    useEffect(() => {
        const subscribe = controls.onInput
        if (!enabled || !subscribe) return
        let latest: ControlInputFrame | null = null
        let raf = 0
        const flush = (): void => {
            raf = 0
            if (latest) useLiveInputStore.getState().setFrame(latest)
            latest = null
        }
        const off = subscribe((frame) => {
            latest = frame
            if (!raf) raf = requestAnimationFrame(flush)
        })
        return () => {
            off()
            cancelAnimationFrame(raf)
            useLiveInputStore.getState().clear()
        }
    }, [controls, enabled])
}
