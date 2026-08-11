// Pattern check: no GoF pattern (-) — rejected — pure mapper/lookup from HID usage +
// binding prefix to a function category + theme-independent oklch tints; mirrors the
// existing labels.ts / hidUsages.ts mapper style. No abstraction or polymorphism warranted.
//
// Function-based colour-coding for keycaps. Categories are theme-INDEPENDENT (a modifier
// is violet in every theme); only the colour-coding *intensity* (off/subtle/vivid) varies.
// Ported from the design handoff's data.jsx derivation.
import { hidUsagePageAndIdFromUsage } from '@/lib/actions/hidUsages'

export type KeyCategory =
    | 'alpha'
    | 'mod'
    | 'layer'
    | 'nav'
    | 'edit'
    | 'num'
    | 'punct'
    | 'media'
    | 'mouse'
    | 'system'
    | 'space'
    | 'trans'

export type ColorMode = 'off' | 'subtle' | 'vivid'

/** Per-category hue (oklch). `null` hue → neutral (no tint). */
export const CATEGORY_META: Record<
    KeyCategory,
    { label: string; hue: number | null }
> = {
    alpha: { label: 'Letter', hue: null },
    mod: { label: 'Modifier', hue: 286 },
    layer: { label: 'Layer', hue: 210 },
    nav: { label: 'Navigation', hue: 80 },
    edit: { label: 'Editing', hue: 152 },
    num: { label: 'Number', hue: 252 },
    punct: { label: 'Symbol', hue: 252 },
    media: { label: 'Media', hue: 348 },
    mouse: { label: 'Mouse', hue: 42 },
    system: { label: 'System', hue: 25 },
    space: { label: 'Space', hue: null },
    trans: { label: 'Pass-thru', hue: null },
}

// pattern-check: skip — hoisting a pure helper above an existing interface
// Per-layer accent hues (Base/Lower/Raise/Nav…), matching the design's
// LAYER_ACCENTS. Shared by the layer picker, the colour rail, and the stage pill.
export const LAYER_ACCENT_HUES = [286, 210, 152, 80]
export const layerAccent = (index: number): string =>
    `oklch(0.7 0.15 ${LAYER_ACCENT_HUES[index % LAYER_ACCENT_HUES.length]})`

export interface CategoryStyle {
    /** legend / text colour */
    legend: string
    /** main cap face fill (null = neutral, use --secondary) */
    face: string | null
    /** slightly lighter top of the face for sculpted depth */
    faceTop: string | null
    /** edge / dot / glow accent */
    edge: string | null
    /** category dot colour */
    dot: string | null
}

const NEUTRAL: CategoryStyle = {
    legend: 'var(--foreground)',
    face: null,
    faceTop: null,
    edge: null,
    dot: null,
}

/**
 * Legend + face tint for a category at a given colour-coding intensity.
 * `off` and hueless categories return neutral (theme-driven) styling.
 */
export function catStyle(cat: KeyCategory, mode: ColorMode): CategoryStyle {
    const hue = CATEGORY_META[cat]?.hue
    if (hue == null || mode === 'off') return NEUTRAL
    const vivid = mode === 'vivid'
    const sat = vivid ? 1 : 0.62
    // Lightness is theme-mode-driven via CSS vars (see index.css `--cap-*-l`):
    // dark mode keeps the design's deep faces + light legends; light mode flips to
    // pale faces + dark legends. Hue + chroma stay fixed so the function colour
    // coding means the same in both modes.
    return {
        legend: `oklch(var(--cap-legend-l) ${0.14 * (vivid ? 1 : 0.85)} ${hue})`,
        face: `oklch(var(--cap-face-l) ${0.055 * sat} ${hue})`,
        faceTop: `oklch(var(--cap-face-top-l) ${0.06 * sat} ${hue})`,
        edge: `oklch(var(--cap-edge-l) 0.16 ${hue})`,
        dot: `oklch(var(--cap-dot-l) 0.16 ${hue})`,
    }
}

// HID usage pages we care about.
const PAGE_KEYBOARD = 0x07
const PAGE_CONSUMER = 0x0c
const PAGE_GENERIC_DESKTOP = 0x01

/** Map a keyboard-page (0x07) usage id to a category. */
function keyboardUsageCategory(id: number): KeyCategory {
    // Letters a–z
    if (id >= 0x04 && id <= 0x1d) return 'alpha'
    // 1–0
    if (id >= 0x1e && id <= 0x27) return 'num'
    if (id === 0x28 || id === 0x58) return 'edit' // Enter / KP Enter
    if (id === 0x29) return 'system' // Escape
    if (id === 0x2a) return 'edit' // Backspace
    if (id === 0x2b) return 'edit' // Tab
    if (id === 0x2c) return 'space' // Space
    // - = [ ] \ ; ' ` , . /  and the non-US keys
    if ((id >= 0x2d && id <= 0x38) || id === 0x64 || id === 0x32) return 'punct'
    if (id === 0x39) return 'mod' // Caps Lock
    // F1–F12 and F13–F24
    if ((id >= 0x3a && id <= 0x45) || (id >= 0x68 && id <= 0x73))
        return 'system'
    if (id === 0x46 || id === 0x47 || id === 0x48) return 'system' // PrtSc/ScrLk/Pause
    if (id === 0x49) return 'edit' // Insert
    if (id === 0x4c) return 'edit' // Delete Forward
    // Home / PageUp / End / PageDown / arrows
    if (id === 0x4a || id === 0x4b || id === 0x4d || id === 0x4e) return 'nav'
    if (id >= 0x4f && id <= 0x52) return 'nav'
    if (id >= 0x53 && id <= 0x63) return 'num' // keypad NumLock + KP digits/ops
    // Left/Right Ctrl/Shift/Alt/GUI
    if (id >= 0xe0 && id <= 0xe7) return 'mod'
    return 'system'
}

/** Derive a category from a full encoded HID usage (page in high word, mods in top byte). */
export function categoryForUsage(usage: number | undefined): KeyCategory {
    if (usage == null) return 'alpha'
    const [pageRaw, id] = hidUsagePageAndIdFromUsage(usage)
    const page = pageRaw & 0xff
    if (page === PAGE_CONSUMER) return 'media'
    if (page === PAGE_GENERIC_DESKTOP) return 'system'
    if (page === PAGE_KEYBOARD) {
        // A modifier applied with no base key (e.g. a bare &kp LSHIFT) → mod.
        if (id === 0) return 'mod'
        return keyboardUsageCategory(id)
    }
    return 'system'
}

// Transparent / empty bindings — ZMK behaviour references plus the QMK-family
// keycode tokens (bindingPrefix carries the wire token there).
const TRANS_PREFIXES = new Set(['&trans', '&none', 'kc_trns', 'kc_no'])

// Binding-prefix groups (ZMK behaviour references).
const LAYER_PREFIXES = new Set([
    '&mo',
    '&lt',
    '&to',
    '&tog',
    '&sl',
    '&sk_layer',
])
const MOUSE_PREFIXES = new Set(['&mkp', '&mmv', '&msc'])

/** The fields of a resolved binding we need to classify it. */
export interface BindingCategoryInput {
    actionLabel?: string // bindingPrefix, e.g. '&kp' / '&mt' / '&lt' / '&trans'
    bindingParam1?: number // primaryUsage (encoded HID usage)
    actionTypeName?: string
    outOfRange?: boolean
    isHoldTap?: boolean
    holdIsLayer?: boolean
}

// pattern-check: skip — splits one classifier into face/accent variants, pure mapper, no abstraction
/**
 * Accent (function) category — drives the header tag + hold-legend colour only.
 *
 * For tap-hold keys the *hold* function dominates (a home-row mod reads as a
 * modifier, a layer-tap reads as a layer) — matching the design's action-tag
 * rule. This is NOT the cap face tint; see {@link faceCategoryForBinding}.
 */
export function categoryForBinding(b: BindingCategoryInput): KeyCategory {
    if (b.outOfRange) return 'trans'
    const prefix = b.actionLabel?.trim().toLowerCase()
    if (TRANS_PREFIXES.has(prefix ?? '')) return 'trans'

    if (b.isHoldTap || prefix === '&mt' || prefix === '&lt') {
        // Layer-tap / momentary-layer-style holds read as layer keys.
        if (b.holdIsLayer || prefix === '&lt') return 'layer'
        // Mod-tap (home-row mods) read as modifiers.
        if (prefix === '&mt') return 'mod'
    }
    if (prefix && LAYER_PREFIXES.has(prefix)) return 'layer'
    if (prefix && MOUSE_PREFIXES.has(prefix)) return 'mouse'

    return categoryForUsage(b.bindingParam1)
}

/**
 * Face (cap-fill) category — drives the keycap tint, the category dot and the
 * tap-legend colour.
 *
 * Unlike {@link categoryForBinding}, a tap-hold key's face follows its *tap*
 * key, so a home-row mod on `A` is a neutral alpha cap and a layer-tap on Space
 * stays a neutral space cap — exactly the design, which only accents the header
 * and hold legend. Pure function keys (a bare layer or mouse behaviour) still
 * tint the whole cap.
 */
export function faceCategoryForBinding(b: BindingCategoryInput): KeyCategory {
    if (b.outOfRange) return 'trans'
    const prefix = b.actionLabel?.trim().toLowerCase()
    if (TRANS_PREFIXES.has(prefix ?? '')) return 'trans'
    // Tap-hold: classify by the tap key alone, leaving the face neutral when the
    // tap is an alpha/space cap.
    if (b.isHoldTap || prefix === '&mt' || prefix === '&lt') {
        return categoryForUsage(b.bindingParam1)
    }
    if (prefix && LAYER_PREFIXES.has(prefix)) return 'layer'
    if (prefix && MOUSE_PREFIXES.has(prefix)) return 'mouse'
    return categoryForUsage(b.bindingParam1)
}

// ---- Heatmap colour ramp (used by the heatmap overlay) -------------------
// 0 → cool blue, 0.5 → violet, 1 → hot red. Returns face + edge oklch strings.
export function heatColor(v: number): { face: string; edge: string } {
    const t = Math.max(0, Math.min(1, v))
    const h = 250 - t * 230
    const l = 0.32 + t * 0.3
    const c = 0.06 + t * 0.16
    return {
        face: `oklch(${l} ${c} ${h})`,
        edge: `oklch(${Math.min(0.78, l + 0.2)} ${c + 0.04} ${h})`,
    }
}
