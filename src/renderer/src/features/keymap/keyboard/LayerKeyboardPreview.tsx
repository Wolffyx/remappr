// pattern-check: skip — presentational mapper from resolved bindings to canvas positions
import { useMemo } from 'react'
import { resolveBindingLabels, type ResolvedHoldTapDescriptor } from '@firmware'
import { PhysicalLayoutCanvas, type KeyPosition } from './PhysicalLayoutCanvas'
import { HidUsageLabel } from './HidUsageLabel'
import { ParamLegend } from './ParamLegend'
import { LegendParts } from './LegendParts'
import { hasResolvableIcon } from './legendIcons'
import type { HoldTapLabels } from './KeyButton'
import { categoryForBinding } from '@/lib/keymap/keyCategory'
import { useLayout } from '@/hooks/use-layouts'
import useKeymapStore from '@/stores/keymapStore'
import useLayerSelectionStore from '@/stores/layerSelectionStore'

function holdTapToLabels(desc: ResolvedHoldTapDescriptor): HoldTapLabels {
    const tap = (
        <HidUsageLabel hid_usage={desc.tapParam} header={desc.actionTypeName} />
    )
    const hold =
        desc.holdNodeKind === 'layer' ? (
            <span>{desc.holdLayerMomentary}</span>
        ) : (
            <HidUsageLabel hid_usage={desc.holdParam} />
        )
    return { tap, hold, tooltip: desc.tooltip }
}

interface LayerKeyboardPreviewProps {
    /** Which physical layout to render (defaults to the active one). */
    physicalLayoutIndex: number
    /** Which keymap layer's bindings to show (defaults to the selected layer). */
    layerIndex?: number
    oneU?: number
}

/**
 * Static, non-interactive mini render of a keymap layer's real keycaps — the
 * design's Layouts hover preview. Flat caps, subtle colour-coding, no header tags,
 * mirroring the prototype's LayoutPreview.
 */
export function LayerKeyboardPreview({
    physicalLayoutIndex,
    layerIndex,
    oneU = 13,
}: LayerKeyboardPreviewProps): JSX.Element | null {
    const { layouts } = useLayout()
    const keymap = useKeymapStore((s) => s.keymap)
    const selectedLayerIndex = useLayerSelectionStore(
        (s) => s.selectedLayerIndex,
    )
    const effectiveLayer = layerIndex ?? selectedLayerIndex

    const positions: KeyPosition[] = useMemo(() => {
        const layout = layouts?.[physicalLayoutIndex]
        if (!layout || !keymap) return []
        return resolveBindingLabels(layout, keymap, effectiveLayer).map(
            (p) => ({
                id: p.id,
                holdTap: p.holdTap ? holdTapToLabels(p.holdTap) : undefined,
                category: categoryForBinding({
                    actionLabel: p.actionLabel,
                    bindingParam1: p.bindingParam1,
                    actionTypeName: p.actionTypeName,
                    outOfRange: p.outOfRange,
                    isHoldTap: !!p.holdTap,
                    holdIsLayer: p.holdTap?.holdNodeKind === 'layer',
                }),
                x: p.x,
                y: p.y,
                width: p.width,
                height: p.height,
                r: p.r,
                rx: p.rx,
                ry: p.ry,
                children: p.outOfRange ? (
                    <span />
                ) : hasResolvableIcon(p.paramParts) ? (
                    <LegendParts parts={p.paramParts!} title={p.paramTitle} />
                ) : p.bindingParam1 == null && p.paramText ? (
                    <ParamLegend text={p.paramText} title={p.paramTitle} />
                ) : (
                    <HidUsageLabel
                        hid_usage={p.bindingParam1!}
                        header={p.actionTypeName || 'Unknown'}
                    />
                ),
            }),
        )
    }, [layouts, keymap, physicalLayoutIndex, effectiveLayer])

    if (positions.length === 0) return null

    return (
        <div className="pointer-events-none leading-[0]">
            <PhysicalLayoutCanvas
                positions={positions}
                oneU={oneU}
                hoverZoom={false}
                capStyleOverride="flat"
                colorModeOverride="subtle"
                showHeaderTag={false}
                showCategoryDot={false}
            />
        </div>
    )
}
