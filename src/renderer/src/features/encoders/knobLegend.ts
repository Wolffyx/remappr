// Pattern check: no GoF pattern (-) — rejected — pure label mappers moved into the encoder module; functions over data, one shape.
//
// What a knob shows for each turn direction. The knob cap on the stage and the
// editor's direction chips both read these, so a chip always matches its half
// of the cap.
import type { EncoderAction, KeyLabel } from '@firmware/types'
import type { LegendPart } from '@firmware/paramLabel'
import { hidUsageLongLabel, usageGlyph } from '@/lib/actions/hidUsages'
import { categoryForBinding, type KeyCategory } from '@/lib/keymap/keyCategory'
import {
    hasResolvableIcon,
    hidUsageIcon,
} from '@/features/keymap/keyboard/legendIcons'
import { ENCODER_DIRS, type EncoderDir } from './model'

export interface KnobSide {
    /** Short value text ("Vol+", "PgDn"); empty = unbound. */
    text: string
    /** Icon legend, shown instead of `text` when present (media, bluetooth…). */
    parts?: LegendPart[]
    /** Full value, for the hover title. */
    title?: string
    category: KeyCategory
}

/** One encoder's legend: a side per turn direction. */
export type KnobLegend = { slot: number } & Record<EncoderDir, KnobSide>

/** The text a half-width knob cap can hold for one direction's action. */
const knobText = (label: KeyLabel): string =>
    (label.primaryUsage != null ? usageGlyph(label.primaryUsage) : '') ||
    label.paramText ||
    label.primary

/** Icon legend for a knob direction: the firmware's own icon parts (bluetooth,
 *  underglow, mouse scroll…), else a media icon for a plain HID usage. */
const knobParts = (label: KeyLabel): LegendPart[] | undefined => {
    if (hasResolvableIcon(label.paramParts)) return label.paramParts
    const icon = hidUsageIcon(label.primaryUsage)
    return icon ? [{ icon, text: knobText(label) }] : undefined
}

/** One turn direction's legend. */
export function knobSide(label: KeyLabel): KnobSide {
    return {
        text: knobText(label),
        parts: knobParts(label),
        title:
            (label.primaryUsage != null
                ? hidUsageLongLabel(label.primaryUsage)
                : undefined) ??
            label.valueLong ??
            label.description,
        category: categoryForBinding({
            actionLabel: label.bindingPrefix,
            bindingParam1: label.primaryUsage,
            actionTypeName: label.primary,
        }),
    }
}

/** Every direction's legend for one encoder. */
export function knobLegend(slot: number, enc: EncoderAction): KnobLegend {
    const sides = Object.fromEntries(
        ENCODER_DIRS.map(({ dir }) => [dir, knobSide(enc[dir].label)]),
    ) as Record<EncoderDir, KnobSide>
    return { slot, ...sides }
}
