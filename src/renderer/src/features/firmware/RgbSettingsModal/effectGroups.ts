// Pattern check: Dispatch Map (Tier 0) — applied — keyword rules → effect group and group → preview builder tables replace if/else chains; same presentational resolver shape as effectIcons.ts.
//
// Presentation of a lighting catalog's effect names (design review f15): each
// name is sorted into a group a person recognises, given a plain-words label,
// and drawn as a small moving preview. Purely presentational — the names come
// from whichever catalog the firmware or the board definition supplies, and the
// rules match by keyword like effectIcons, so no firmware's list is copied here.

export type EffectGroup =
    | 'Basic'
    | 'Gradient'
    | 'Band'
    | 'Rainbow cycle'
    | 'Reactive'
    | 'Rain & pixels'
    | 'Other'

/** Display order of the groups. */
export const EFFECT_GROUPS: readonly EffectGroup[] = [
    'Basic',
    'Gradient',
    'Band',
    'Rainbow cycle',
    'Reactive',
    'Rain & pixels',
    'Other',
]

// More specific patterns first.
const GROUP_RULES: readonly [RegExp, EffectGroup][] = [
    [/reactive|splash|heatmap|typing/i, 'Reactive'],
    [/gradient/i, 'Gradient'],
    [/none|^off$|solid|static|^colou?r$|alphas|breath/i, 'Basic'],
    [
        /raindrop|\brain\b|pixel|twinkle|starlight|jellybean|digital|christmas/i,
        'Rain & pixels',
    ],
    [/band/i, 'Band'],
    [
        /cycle|rainbow|spectrum|swirl|spiral|pinwheel|beacon|chevron|hue|wave|snake|knight/i,
        'Rainbow cycle',
    ],
]

export const groupOf = (name: string): EffectGroup =>
    GROUP_RULES.find(([re]) => re.test(name))?.[1] ?? 'Other'

const WORDS: readonly [RegExp, string][] = [
    [/[_\s]+/g, ' '],
    [/\bsat\b/gi, 'saturation'],
    [/\bval\b/gi, 'brightness'],
    [/\bcolor\b/gi, 'colour'],
    [/\bup[\s/]down\b/gi, 'up–down'],
    [/\bleft[\s/]right\b/gi, 'left–right'],
    [/\bout[\s/]in\b/gi, 'out–in'],
]

/** "Cycle_Left_Right" / "Band Sat" → "Cycle left–right" / "Band saturation". */
export function plainName(name: string): string {
    const words = WORDS.reduce((s, [re, to]) => s.replace(re, to), name)
        .trim()
        .toLowerCase()
    return words.charAt(0).toUpperCase() + words.slice(1)
}

export interface GroupedEffect {
    /** Index in the catalog (the firmware's mode value). */
    index: number
    name: string
    label: string
}

/** The effects in display groups (empty groups dropped), filtered by `query`
 *  against both the plain label and the firmware's own name. */
export function groupEffects(
    effects: readonly string[],
    query = '',
): { group: EffectGroup; items: GroupedEffect[] }[] {
    const q = query.trim().toLowerCase()
    const all = effects.map((name, index) => ({
        index,
        name,
        label: plainName(name),
    }))
    const hit = (e: GroupedEffect): boolean =>
        !q ||
        e.label.toLowerCase().includes(q) ||
        e.name.toLowerCase().includes(q)
    return EFFECT_GROUPS.map((group) => ({
        group,
        items: all.filter((e) => groupOf(e.name) === group && hit(e)),
    })).filter((g) => g.items.length > 0)
}

/** A light colour at hue `h` (degrees, the firmware's HSV hue, as on the
 *  colour wheel); `l` is lightness 0–1, `c` saturation 0–1. These previews
 *  show light, not UI, so they are real colours rather than theme tokens. */
const light = (h: number, l = 0.6, c = 1): string =>
    `hsl(${h} ${Math.round(c * 100)}% ${Math.round(l * 100)}%)`

const rainbow = (): string =>
    [0, 60, 120, 180, 240, 300, 360, 420, 480, 540, 600, 660, 720]
        .map((h) => light(h))
        .join(', ')

export interface EffectPreview {
    background: string
    /** Animation class from index.css: moving or pulsing. */
    motion: 'none' | 'move' | 'pulse'
}

const PREVIEW: Readonly<
    Record<EffectGroup, (hue: number, off: boolean) => EffectPreview>
> = {
    Basic: (hue, off) => ({
        background: off
            ? 'color-mix(in oklab, var(--foreground) 8%, transparent)'
            : light(hue),
        motion: 'none',
    }),
    Gradient: (hue) => ({
        background: `linear-gradient(90deg, ${light(hue)}, ${light(hue + 60)}, ${light(hue)})`,
        motion: 'move',
    }),
    Band: (hue) => ({
        background: `linear-gradient(90deg, ${light(hue, 0.2, 0.5)}, ${light(hue)}, ${light(hue, 0.2, 0.5)}, ${light(hue)}, ${light(hue, 0.2, 0.5)})`,
        motion: 'move',
    }),
    'Rainbow cycle': () => ({
        background: `linear-gradient(90deg, ${rainbow()})`,
        motion: 'move',
    }),
    Reactive: (hue) => ({
        background: `radial-gradient(circle at 50% 50%, ${light(hue + 60, 0.85)} 0 5px, ${light(hue)} 14px)`,
        motion: 'pulse',
    }),
    'Rain & pixels': (hue) => ({
        background: `radial-gradient(circle at 20% 50%, ${light(145)} 0 3px, transparent 4px), radial-gradient(circle at 55% 40%, ${light(200)} 0 3px, transparent 4px), radial-gradient(circle at 80% 60%, ${light(330)} 0 3px, transparent 4px), ${light(hue, 0.15, 0.4)}`,
        motion: 'move',
    }),
    Other: () => ({
        background: `linear-gradient(90deg, ${rainbow()})`,
        motion: 'move',
    }),
}

/** How effect `name` looks, tinted with the chosen `hue` where it uses one. */
export function previewOf(name: string, hue: number): EffectPreview {
    const off = /none|^off$/i.test(name)
    const base = PREVIEW[groupOf(name)](hue, off)
    return /breath/i.test(name) ? { ...base, motion: 'pulse' } : base
}
