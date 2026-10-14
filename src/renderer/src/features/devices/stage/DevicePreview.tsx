// Pattern check: no GoF pattern (-) — rejected — thin wrapper: a non-interactive DeviceStage tinted from cached colour categories, for start-page cards.
import type { JSX } from 'react'
import type { PreviewDevice } from '@/stores/devicePreviewStore'
import { indexCatalog } from '@/lib/devices/bindingSummary'
import { DeviceStage } from './DeviceStage'

const EMPTY_INDEX = indexCatalog({
    groups: [],
    actions: [],
    outputs: {},
    fields: {},
})
const NO_BINDINGS = {}

/** A cached controls device drawn small, tinted the way it was last bound. */
export function DevicePreview({
    device,
    className,
}: {
    device: PreviewDevice
    className?: string
}): JSX.Element {
    return (
        <DeviceStage
            model={device.model}
            bindings={NO_BINDINGS}
            index={EMPTY_INDEX}
            categories={device.categories}
            labels="clean"
            preview
            className={className ?? 'inset-0'}
        />
    )
}
