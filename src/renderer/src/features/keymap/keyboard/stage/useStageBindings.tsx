// pattern-check: skip — position/label resolution + heatmap inject extracted from KeyboardView
import { useMemo } from 'react'
import type { Keymap } from '@firmware/types'
import { resolveBindingLabels } from '@firmware'
import {
    hidUsageLongLabel,
    usageGlyph,
    usageModifierNames,
} from '@/lib/actions/hidUsages'
import {
    categoryForBinding,
    faceCategoryForBinding,
} from '@/lib/keymap/keyCategory'
import { HidUsageLabel } from '../HidUsageLabel'
import type { KeyPosition } from '../PhysicalLayoutCanvas'
import type { KeypressDetectionConfig } from '@/lib/keypress/keypressDetector'
import { ParamLegend } from '../ParamLegend'
import { LegendParts } from '../LegendParts'
import { hasResolvableIcon } from '../legendIcons'
import { holdTapToLabels } from './helpers'

/** Readable text join of legend parts (skips empty parts) — used as the sizing
 *  proxy + tooltip fallback when a cap renders composite icon parts. */
const partsText = (parts: { text: string }[]): string =>
    parts
        .map((p) => p.text)
        .filter(Boolean)
        .join(' ')

interface Inputs {
    layouts: KeypressDetectionConfig['layouts'] | undefined
    keymap: Keymap | undefined
    selectedPhysicalLayoutIndex: number
    displayLayerIndex: number
    heatmapEnabled: boolean
    heatmapCounts: Record<string, number>
}

/** Resolved KeyPositions for the active layer (legends + categories + encoders),
 *  with heatmap tint/counts injected when the heatmap is on. */
export function useStageBindings({
    layouts,
    keymap,
    selectedPhysicalLayoutIndex,
    displayLayerIndex,
    heatmapEnabled,
    heatmapCounts,
}: Inputs): KeyPosition[] {
    const basePositions: KeyPosition[] = useMemo(() => {
        if (!layouts || !keymap) return []
        const layout = layouts[selectedPhysicalLayoutIndex]
        if (!layout) return []
        const keyPositions: KeyPosition[] = resolveBindingLabels(
            layout,
            keymap,
            displayLayerIndex,
        ).map((p) => ({
            id: p.id,
            header: p.header,
            // Tap glyph text (e.g. "Q", "Vol+") for legend sizing — mirrors what
            // HidUsageLabel renders, so KeyButton sizes the legend off the glyph
            // length (design rule), not the action-type tag in `header`. For
            // non-HID params (layer / enum / number) fall back to the firmware-
            // resolved short text (e.g. "FN1", "BT 0", "Hue+").
            tapText: p.outOfRange
                ? ''
                : p.bindingParam1 != null
                  ? usageGlyph(p.bindingParam1)
                  : (p.paramText ??
                    (p.paramParts ? partsText(p.paramParts) : '')),
            // Full value for the tooltip when the cap glyph is abbreviated: HID
            // keys use the long usage label; enum/number params carry the full
            // friendly value name (e.g. "Select Profile 1") — the cap shows the
            // short "Sel 1" but the tooltip should read in full.
            valueTitle:
                !p.outOfRange && p.bindingParam1 != null
                    ? hidUsageLongLabel(p.bindingParam1)
                    : p.valueLong,
            actionLabel: p.actionLabel,
            holdTap: p.holdTap ? holdTapToLabels(p.holdTap) : undefined,
            // Chord modifiers (Ctrl/Shift/…) packed in the tap usage's high byte
            // → rendered as chips by KeyButton (the inline "CS" line is suppressed
            // via hideMods on the legend below). Mod-tap reads its tap param.
            mods: (() => {
                const u = p.holdTap ? p.holdTap.tapParam : p.bindingParam1
                const names = u != null ? usageModifierNames(u) : []
                return names.length ? names : undefined
            })(),
            // Face tint follows the tap key; the header tag + hold legend follow
            // the hold/function category. A home-row mod is thus a neutral alpha
            // cap with a violet "Mod-Tap" tag — matching the design.
            category: faceCategoryForBinding({
                actionLabel: p.actionLabel,
                bindingParam1: p.bindingParam1,
                actionTypeName: p.actionTypeName,
                outOfRange: p.outOfRange,
                isHoldTap: !!p.holdTap,
                holdIsLayer: p.holdTap?.holdNodeKind === 'layer',
            }),
            accentCategory: categoryForBinding({
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
                <span></span>
            ) : hasResolvableIcon(p.paramParts) ? (
                <LegendParts parts={p.paramParts!} title={p.paramTitle} />
            ) : p.bindingParam1 == null && p.paramText ? (
                <ParamLegend text={p.paramText} title={p.paramTitle} />
            ) : (
                <HidUsageLabel
                    hid_usage={p.bindingParam1!}
                    header={p.actionTypeName || 'Unknown'}
                    hideMods
                />
            ),
        }))

        const encoderActions = keymap.layers[displayLayerIndex]?.encoders
        const encoderSlots = layout.encoders ?? []
        if (!encoderActions || encoderSlots.length === 0) return keyPositions

        const encoderPositions: KeyPosition[] = []
        encoderSlots.forEach((slot, i) => {
            const action = encoderActions[i]
            if (!action) return
            // Two half-unit buttons side by side: ccw left, cw right. Prefer the
            // short param text (e.g. "FN1", "BT 0") over the action-type name.
            const ccwText =
                action.ccw.label.paramText ?? action.ccw.label.primary
            const cwText = action.cw.label.paramText ?? action.cw.label.primary
            encoderPositions.push({
                id: `enc-${i}-ccw`,
                header: 'CCW',
                actionLabel: ccwText,
                x: slot.x,
                y: slot.y,
                width: 0.5,
                height: 1,
                encoder: { slot: i, dir: 'ccw' },
                children: <span>{ccwText}</span>,
            })
            encoderPositions.push({
                id: `enc-${i}-cw`,
                header: 'CW',
                actionLabel: cwText,
                x: slot.x + 0.5,
                y: slot.y,
                width: 0.5,
                height: 1,
                encoder: { slot: i, dir: 'cw' },
                children: <span>{cwText}</span>,
            })
        })
        return [...keyPositions, ...encoderPositions]
    }, [layouts, keymap, selectedPhysicalLayoutIndex, displayLayerIndex])

    // Inject heatmap tint + raw counts without rebuilding the (expensive) label nodes.
    return useMemo(() => {
        if (!heatmapEnabled) return basePositions
        let max = 0
        basePositions.forEach((p, idx) => {
            if (p.encoder) return
            const c =
                heatmapCounts[`${selectedPhysicalLayoutIndex}:${idx}`] ?? 0
            if (c > max) max = c
        })
        return basePositions.map((p, idx) => {
            if (p.encoder) return p
            const c =
                heatmapCounts[`${selectedPhysicalLayoutIndex}:${idx}`] ?? 0
            return {
                ...p,
                heat: max > 0 ? c / max : null,
                pressCount: c,
            }
        })
    }, [
        basePositions,
        heatmapEnabled,
        heatmapCounts,
        selectedPhysicalLayoutIndex,
    ])
}
