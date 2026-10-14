// Pattern check: no GoF pattern (-) — rejected — pure lookup from an action category to theme-aware oklch colours, same mapper style as lib/keymap/keyCategory.ts.
//
// Colours for device controls and the actions bound to them. The category tag
// comes from the adapter's catalog; only the colouring lives here. Lightness of
// legends, dots and edges follows the theme mode through the same `--cap-*-l`
// variables the keycaps use, so a control reads in light and dark alike.
import type { DeviceActionCategory } from '@firmware/devices/types'

export const DEVICE_CATEGORY_META: Readonly<
    Record<DeviceActionCategory, { label: string; hue: number | null }>
> = {
    mouse: { label: 'Mouse', hue: 42 },
    key: { label: 'Keyboard', hue: null },
    media: { label: 'Media', hue: 348 },
    pad: { label: 'Gamepad', hue: 252 },
    system: { label: 'System', hue: 25 },
    macro: { label: 'Macro', hue: 152 },
    profile: { label: 'Layer / profile', hue: 286 },
    none: { label: 'Disabled', hue: null },
}

/** Categories shown in the editor's "Action types" legend, in order. */
export const LEGEND_CATEGORIES: readonly DeviceActionCategory[] = [
    'mouse',
    'key',
    'pad',
    'media',
    'macro',
    'system',
    'profile',
]

/** The solid accent of a category (dots, chips); neutral when it has no hue. */
export function categoryAccent(cat: DeviceActionCategory): string {
    const hue = DEVICE_CATEGORY_META[cat].hue
    return hue == null
        ? 'var(--muted-foreground)'
        : `oklch(var(--cap-dot-l) 0.15 ${hue})`
}

export interface ControlColors {
    face: string
    top: string
    edge: string
    ink: string
    glow: string
}

const NEUTRAL: ControlColors = {
    face: 'color-mix(in oklch, var(--foreground) 7%, var(--card))',
    top: 'color-mix(in oklch, var(--foreground) 11%, var(--card))',
    edge: 'color-mix(in oklch, var(--foreground) 22%, transparent)',
    ink: 'var(--card-foreground)',
    glow: 'var(--primary)',
}

/** Fill, edge, legend and glow of a control bound to a `cat` action; `mono`
 *  draws every control neutral. */
export function controlColors(
    cat: DeviceActionCategory,
    mono = false,
): ControlColors {
    const hue = DEVICE_CATEGORY_META[cat].hue
    if (mono || hue == null) return NEUTRAL
    return {
        face: `color-mix(in oklch, oklch(0.6 0.14 ${hue}) 16%, var(--card))`,
        top: `color-mix(in oklch, oklch(0.62 0.14 ${hue}) 24%, var(--card))`,
        edge: `oklch(var(--cap-edge-l) 0.13 ${hue} / 0.55)`,
        ink: `oklch(var(--cap-legend-l) 0.11 ${hue})`,
        glow: `oklch(0.7 0.16 ${hue})`,
    }
}

/** Accent hues of a device's profiles, by index (Default, Gaming, Work, …). */
const PROFILE_HUES = [286, 25, 152, 210, 80, 348, 252] as const

export const profileAccent = (index: number): string =>
    `oklch(0.7 0.15 ${PROFILE_HUES[index % PROFILE_HUES.length]})`
