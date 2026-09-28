// Pattern check: no GoF pattern (-) — rejected — headless effect that maps the live base
// layer to a serializable preview snapshot (shape + colour category, no legends);
// reuses resolveBindingLabels/categoryForBinding.
import { useEffect, useRef } from 'react'
import { resolveBindingLabels } from '@firmware'
import { useLayout } from '@/hooks/use-layouts'
import useKeymapStore from '@/stores/keymapStore'
import useConnectionStore from '@/stores/connectionStore'
import useDevicePreviewStore, {
    type PreviewKey,
} from '@/stores/devicePreviewStore'
import { categoryForBinding } from '@/lib/keymap/keyCategory'

/**
 * Mounted in the editor; while connected, captures the device's base-layer geometry,
 * key colour categories and encoder slots (never what the keys are bound to) into
 * the persisted device-preview store so the start-page card can show the real
 * layout after disconnect. Renders nothing.
 */
export function DevicePreviewCapture(): null {
    const { layouts, selectedPhysicalLayoutIndex } = useLayout()
    // Subscribe to the base-layer slice, not the whole keymap: immer edits on
    // other layers keep layers[0]'s identity, so editing layer 3 no longer
    // re-runs the (per-key) resolveBindingLabels pass below on every keystroke.
    const baseLayer = useKeymapStore((s) => s.keymap?.layers[0])
    const layerCount = useKeymapStore((s) => s.keymap?.layers.length ?? 0)
    const service = useConnectionStore((s) => s.service)
    const communication = useConnectionStore((s) => s.communication)
    const lastConnectedDevice = useConnectionStore((s) => s.lastConnectedDevice)
    const saveSnapshot = useDevicePreviewStore((s) => s.saveSnapshot)
    const lastSignature = useRef<string | null>(null)

    useEffect(() => {
        // The full keymap is read imperatively — the effect re-runs on the
        // narrower baseLayer/layerCount subscriptions above.
        const keymap = useKeymapStore.getState().keymap
        if (!service || !layouts || !keymap || !baseLayer) return
        // Demo keyboards never appear in the discovered-device list, so their
        // snapshots can't be shown — capturing one only risks clobbering a real slot.
        if (service.capabilities.demo) return
        const layout = layouts[selectedPhysicalLayoutIndex]
        if (!layout || keymap.layers.length === 0) return

        const keys: PreviewKey[] = resolveBindingLabels(layout, keymap, 0).map(
            (p): PreviewKey => ({
                x: p.x,
                y: p.y,
                width: p.width,
                height: p.height,
                r: p.r,
                rx: p.rx,
                ry: p.ry,
                category: categoryForBinding({
                    actionLabel: p.actionLabel,
                    bindingParam1: p.bindingParam1,
                    actionTypeName: p.actionTypeName,
                    outOfRange: p.outOfRange,
                    isHoldTap: !!p.holdTap,
                    holdIsLayer: p.holdTap?.holdNodeKind === 'layer',
                }),
            }),
        )
        // Slots are in centi-units like the raw layout; keys above are in U.
        const encoders = (layout.encoders ?? []).map(({ x, y }) => ({
            x: x / 100,
            y: y / 100,
        }))

        const key = lastConnectedDevice?.id ?? service.deviceInfo.name
        const signature = `${key}|${selectedPhysicalLayoutIndex}|${keymap.layers.length}|${encoders.length}|${keys
            .map((k) => k.category)
            .join(',')}`
        if (signature === lastSignature.current) return
        lastSignature.current = signature

        saveSnapshot(key, {
            name: service.deviceInfo.name,
            communication: communication ?? 'hid',
            keyCount: layout.keys.length,
            layerCount: keymap.layers.length,
            keys,
            encoders,
            savedAt: Date.now(),
        })
    }, [
        service,
        layouts,
        baseLayer,
        layerCount,
        selectedPhysicalLayoutIndex,
        communication,
        lastConnectedDevice,
        saveSnapshot,
    ])

    return null
}
