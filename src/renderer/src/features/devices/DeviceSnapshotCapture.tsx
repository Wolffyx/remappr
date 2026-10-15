// Pattern check: no GoF pattern (-) — rejected — headless effect, the controls-device twin of features/connection/DevicePreviewCapture.tsx: caches layout + colour categories for the start-page card.
import { useEffect, useRef } from 'react'
import { GENERIC_FIRMWARE } from '@firmware/generic'
import { bindingSummary } from '@/lib/devices/bindingSummary'
import useConnectionStore from '@/stores/connectionStore'
import useDevicePreviewStore from '@/stores/devicePreviewStore'
import useDeviceEditorStore, {
    selectActiveBindings,
} from './model/deviceEditorStore'

/** While a controls device is open, keep its start-page card preview current:
 *  the layout and what colour each control is bound to (never the binding). */
export function DeviceSnapshotCapture(): null {
    const service = useConnectionStore((s) => s.service)
    const communication = useConnectionStore((s) => s.communication)
    const lastConnectedDevice = useConnectionStore((s) => s.lastConnectedDevice)
    const viewingNode = useConnectionStore((s) => s.parentService !== null)
    const loaded = useDeviceEditorStore((s) => s.loaded)
    const profileCount = useDeviceEditorStore((s) => s.profiles.length)
    const bindings = useDeviceEditorStore(selectActiveBindings)
    const ready = useDeviceEditorStore((s) => s.status === 'ready')
    const saveSnapshot = useDevicePreviewStore((s) => s.saveSnapshot)
    const lastSignature = useRef<string | null>(null)

    useEffect(() => {
        // Demo devices are never listed on the start page; a generic device's
        // tile previews itself from its source.
        if (!service || !loaded || !ready || service.capabilities.demo) return
        if (service.deviceInfo.firmware === GENERIC_FIRMWARE) return
        // A node opened through the dongle is not the device the card lists:
        // its snapshot would land on the dongle's card.
        if (viewingNode) return
        const { model, index } = loaded
        const categories = Object.fromEntries(
            model.controls.map((c) => [
                c.id,
                bindingSummary(c, bindings, index).cat,
            ]),
        )
        const key = lastConnectedDevice?.id ?? service.deviceInfo.name
        const signature = `${key}|${model.controls.length}|${JSON.stringify(categories)}`
        if (signature === lastSignature.current) return
        lastSignature.current = signature
        saveSnapshot(key, {
            name: service.deviceInfo.name,
            communication: communication ?? 'hid',
            keyCount: model.controls.length,
            layerCount: profileCount,
            keys: [],
            device: { model, categories },
            savedAt: Date.now(),
        })
    }, [
        service,
        loaded,
        ready,
        bindings,
        profileCount,
        communication,
        lastConnectedDevice,
        viewingNode,
        saveSnapshot,
    ])
    return null
}
