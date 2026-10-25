// Pattern check: no GoF pattern (-) — rejected — presentational mapper from a PhysicalLayout to the existing MiniKeyboardPreview; no abstraction.
import { useMemo } from 'react'
import type { PhysicalLayout } from '@firmware/types'
import { MiniKeyboardPreview } from '@/features/connection/start-page/MiniKeyboardPreview'
import type { PreviewEncoder, PreviewKey } from '@/stores/devicePreviewStore'

// Layouts are in centi-units and centi-degrees; the preview takes units.
const C = 100

/** A physical layout's shape only: blank caps and knobs, no bindings, so the
 *  layouts can be told apart by their geometry alone. */
// pattern-check: skip — presentational props change (fit box instead of fixed key size)
export function LayoutThumb({
    layout,
    fit,
    maxOneU,
}: {
    layout: Pick<PhysicalLayout, 'keys' | 'encoders'>
    /** The box (px) the whole layout must fit in. */
    fit: { width: number; height: number }
    /** Largest key size (px), so small boards don't blow up. */
    maxOneU: number
}): JSX.Element {
    const { keys, encoders, oneU } = useMemo(() => {
        const keys = layout.keys.map(
            (k): PreviewKey => ({
                x: k.x / C,
                y: k.y / C,
                width: k.w / C,
                height: k.h / C,
                r: (k.r ?? 0) / C,
                rx: (k.rx ?? 0) / C,
                ry: (k.ry ?? 0) / C,
                category: 'alpha',
            }),
        )
        const encoders = (layout.encoders ?? []).map(
            (e): PreviewEncoder => ({ x: e.x / C, y: e.y / C }),
        )
        // Knobs draw as 1u caps, like keys.
        const extent = [
            ...keys,
            ...encoders.map((e) => ({ ...e, width: 1, height: 1 })),
        ]
        const spanX = Math.max(1, ...extent.map((k) => k.x + k.width))
        const spanY = Math.max(1, ...extent.map((k) => k.y + k.height))
        const oneU = Math.min(maxOneU, fit.width / spanX, fit.height / spanY)
        return { keys, encoders, oneU }
    }, [layout, fit.width, fit.height, maxOneU])
    return <MiniKeyboardPreview keys={keys} encoders={encoders} oneU={oneU} />
}
