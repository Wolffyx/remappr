// Pattern check: Adapter (Tier 1) — applied — lightingFromCanon / lightingFromSim
// convert two distinct store shapes (the builder's CanonLighting and the editor's
// sim RGB state) into one UnifiedLighting interface that the glow engine consumes.
//
// Shared RGB simulation engine — a TS port of the design prototype's app/Lighting.jsx.
// Renders a real-keyboard-style per-key underglow (a colored bloom around each key's
// outer edge; the cap face keeps its own color) and animates it per the selected
// effect. Consumed by both the editor/demo keyboard (PhysicalLayoutCanvas) and the
// builder canvas (BuilderCanvas) through the same <KeyLight> layer in KeyButton.
//
// Canonical effects: solid · breathe · rainbow · swirl · reactive · wave · twinkle ·
//                    gradient · off
import type { CSSProperties } from 'react'
import type { CanonLighting } from '@firmware/config'
import type { HsvColor, RgbEffectState } from '@firmware/service'
import type { LightingCatalog } from '@firmware/lighting'

export type LightingEffect =
    | 'solid'
    | 'breathe'
    | 'rainbow'
    | 'swirl'
    | 'reactive'
    | 'wave'
    | 'twinkle'
    | 'gradient'
    | 'off'

/** The single config shape the glow engine consumes (both adapters target it). */
export interface UnifiedLighting {
    enabled: boolean
    effect: LightingEffect
    hue: number // 0..360 base hue
    rainbow: boolean // spread hues across the board even on a static effect
    sat: number // 0..1
    brightness: number // 0..1
    speed: number // 0..1 (drives animation duration)
    underglow: boolean // weights the glow
    backlight: boolean
    perKey: boolean
}

/** Editor/demo simulation state (lifted to lightingStore, persisted). Mirrors the
 *  prototype's RGB dialog state: brightness/saturation/speed are 0–100 percents. */
export interface SimLighting {
    effect: LightingEffect
    bright: number // 0..100
    speed: number // 0..100
    hue: number // 0..360
    sat: number // 0..100
    perKey: boolean
    underglow: boolean
    backlight: boolean
}

/** Per-key input handed to <KeyLight> by a canvas (key centre normalized 0..1). */
// pattern-check: skip — one optional DTO field (per-key colour), pure data plumbing
export interface KeyLightInput {
    cfg: UnifiedLighting
    fx: number
    fy: number
    idx: number
    /** Optional per-key colour (device HSV, 0–255). When set it overrides the
     *  effect's computed hue so the glow shows the keyboard's / painted per-key
     *  colour. The single firmware-agnostic seam for per-key colour → glow. */
    color?: HsvColor
}

/** Effects offered by the editor's lighting modal (in display order). */
export const LIGHTING_EFFECTS: LightingEffect[] = [
    'solid',
    'breathe',
    'rainbow',
    'swirl',
    'reactive',
    'wave',
    'twinkle',
    'gradient',
    'off',
]

/** Prototype defaults for the editor/demo simulation. */
export const SIM_DEFAULTS: SimLighting = {
    effect: 'rainbow',
    bright: 72,
    speed: 50,
    hue: 286,
    sat: 90,
    perKey: false,
    underglow: true,
    backlight: true,
}

const DISABLED: UnifiedLighting = {
    enabled: false,
    effect: 'off',
    hue: 286,
    rainbow: false,
    sat: 0.9,
    brightness: 0,
    speed: 0.5,
    underglow: true,
    backlight: true,
    perKey: false,
}

/* ---- effect-name normalization ---- */
const EFFECT_ALIAS: Record<string, LightingEffect> = {
    static: 'solid',
    breathing: 'breathe',
    Solid: 'solid',
    Breathe: 'breathe',
    Rainbow: 'rainbow',
    Swirl: 'swirl',
    Reactive: 'reactive',
    Gradient: 'gradient',
}

export function canonEffect(e: string | undefined): LightingEffect {
    return (
        EFFECT_ALIAS[e ?? ''] ??
        (String(e ?? 'solid').toLowerCase() as LightingEffect)
    )
}

/* ---- adapters: normalize the two stores into one config shape ---- */

/** Builder adapter: CanonLighting (config.keyboard.lighting) → UnifiedLighting. */
export function lightingFromCanon(
    L: CanonLighting | undefined,
): UnifiedLighting {
    const under = !!L?.underglow
    const back = !!L?.backlight
    if (!under && !back) return DISABLED
    let effect = canonEffect(L?.underglow?.effect || 'solid')
    // a backlight-only board with breathing enabled → breathe
    if (back && !under && L?.backlight?.breathing && effect === 'solid')
        effect = 'breathe'
    const hueVal = L?.underglow?.hue
    // an undefined hue swatch means "rainbow" in the builder's color picker
    const rainbow =
        (under && hueVal == null) || effect === 'rainbow' || effect === 'swirl'
    const hue = typeof hueVal === 'number' ? hueVal : 286
    const brightness =
        (under
            ? (L?.underglow?.brightness ?? 80)
            : (L?.backlight?.brightness ?? 70)) / 100
    return {
        enabled: true,
        effect,
        rainbow,
        hue,
        sat: 0.92,
        brightness,
        speed: 0.5,
        underglow: under,
        backlight: back,
        perKey: false,
    }
}

/** Editor adapter: sim RGB state → UnifiedLighting. */
export function lightingFromSim(r: SimLighting | undefined): UnifiedLighting {
    if (!r) return DISABLED
    const effect = canonEffect(r.effect)
    if (effect === 'off') return DISABLED
    const rainbow = effect === 'rainbow' || effect === 'swirl'
    return {
        enabled: true,
        effect,
        rainbow,
        hue: r.hue ?? 286,
        sat: (r.sat ?? 90) / 100,
        brightness: (r.bright ?? 80) / 100,
        speed: (r.speed ?? 50) / 100,
        underglow: r.underglow !== false,
        backlight: r.backlight !== false,
        perKey: !!r.perKey,
    }
}

/** Map a firmware effect name (Keychron/QMK/ZMK, dozens of variants) to the nearest
 *  of the engine's canonical effects. Ordered specific → general. */
function deviceEffect(name: string): LightingEffect {
    const n = name.toLowerCase()
    if (/none|^off|^solid|static|^color|alphas/.test(n)) {
        return /none|^off/.test(n) ? 'off' : 'solid'
    }
    if (/reactive|splash|heatmap|typing/.test(n)) return 'reactive'
    if (/breath/.test(n)) return 'breathe'
    if (/twinkle|starlight|pixel|jellybean|christmas|rain|sparkle/.test(n))
        return 'twinkle'
    if (/spiral|swirl|pinwheel|tornado|fan/.test(n)) return 'swirl'
    if (/wave|snake|river|flow|chevron|pendulum|knight/.test(n)) return 'wave'
    if (/gradient|band/.test(n)) return 'gradient'
    if (/rainbow|spectrum|cycle|hue|beacon/.test(n)) return 'rainbow'
    return 'solid'
}

/** Device adapter: the keyboard's live RGB effect state → UnifiedLighting. Drives the
 *  glow from the keyboard's actual global settings (effect / hue / brightness / speed).
 *  Per-key colours, when the firmware reports them (Keychron `getPerKeyColors`), are
 *  layered on separately via KeyLightInput.color. HSV bytes are 0–255. */
export function lightingFromDevice(
    state: RgbEffectState,
    effectName: string,
    catalog: LightingCatalog,
): UnifiedLighting {
    const effect = deviceEffect(effectName)
    if (effect === 'off' || state.brightness <= 0) return DISABLED
    const n = effectName.toLowerCase()
    const multiHue = /rainbow|spectrum|cycle|hue/.test(n)
    return {
        enabled: true,
        effect,
        rainbow: multiHue || effect === 'rainbow' || effect === 'swirl',
        hue: catalog.hasColor ? (state.color.h / 255) * 360 : 286,
        sat: catalog.hasColor ? state.color.s / 255 : 0.92,
        brightness: state.brightness / 255,
        speed: catalog.hasSpeed ? state.speed / 255 : 0.5,
        underglow: true,
        backlight: true,
        perKey: false,
    }
}

/* ---- math helpers ---- */
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t
const mix = (color: string, pct: number): string =>
    `color-mix(in oklab, ${color} ${Math.max(0, Math.min(100, pct)).toFixed(1)}%, transparent)`

/** One key's computed glow layer, or null when nothing should render. */
export interface KeyLightResult {
    style: CSSProperties
    /** true for the 'reactive' effect — the layer brightens on hover/press. */
    reactive: boolean
}

/** Compute the inline style for one key's glow. fx/fy ∈ 0..1 are the key centre's
 *  normalized position on the board (drives the spatial hue). lit = hovered/pressed
 *  (used by the 'reactive' effect). */
export function computeKeyLight(
    cfg: UnifiedLighting | undefined,
    fx: number,
    fy: number,
    idx: number,
    oneU: number,
    lit: boolean,
    perKeyColor?: HsvColor,
): KeyLightResult | null {
    if (!cfg || !cfg.enabled || cfg.effect === 'off') return null

    // Per-key colour override (paint mode / device-reported colours): a steady glow
    // of this key's own colour, ignoring the effect's spatial hue + animation. HSV
    // bytes are 0–255. v == 0 means the LED is off → no glow.
    if (perKeyColor) {
        const pkBright = perKeyColor.v / 255
        if (pkBright <= 0.01) return null
        const pkHue = ((((perKeyColor.h / 255) * 360) % 360) + 360) % 360
        const pkSat = perKeyColor.s / 255
        const pkChroma = (0.05 + pkSat * 0.135).toFixed(3)
        const pkColor = `oklch(0.68 ${pkChroma} ${pkHue.toFixed(1)})`
        const pkGlowK = cfg.underglow !== false ? 1 : 0.6
        return {
            style: {
                position: 'absolute',
                inset: 0,
                borderRadius: 'inherit',
                pointerEvents: 'none',
                boxShadow: `0 0 ${(oneU * 0.13).toFixed(1)}px ${mix(pkColor, pkBright * 58 * pkGlowK)}, 0 ${(oneU * 0.05).toFixed(1)}px ${(oneU * 0.22).toFixed(1)}px ${mix(pkColor, pkBright * 34 * pkGlowK)}`,
                mixBlendMode: 'screen',
            },
            reactive: false,
        }
    }

    const e = cfg.effect
    const sat = cfg.sat ?? 0.9
    const bright = cfg.brightness ?? 0.8
    const speed = cfg.speed ?? 0.5
    if (bright <= 0.01) return null

    // base hue — position dependent for spatial effects
    let hue = cfg.hue ?? 286
    const ang = (Math.atan2(fy - 0.5, fx - 0.5) * 180) / Math.PI // -180..180
    if (e === 'swirl') hue = cfg.hue + ang
    else if (e === 'gradient') hue = cfg.hue + fx * 130
    else if (e === 'rainbow') hue = cfg.hue + fx * 300
    else if (e === 'wave') hue = cfg.hue + fx * 220
    else if (cfg.rainbow) hue = cfg.hue + fx * 300 // rainbow colour on a static effect
    hue = ((hue % 360) + 360) % 360

    const chroma = (0.05 + sat * 0.135).toFixed(3)
    const color = `oklch(0.68 ${chroma} ${hue.toFixed(1)})`

    // backlight (face tint) vs underglow (outer bloom) weighting
    const glowK = cfg.underglow !== false ? 1 : 0.6

    // glow ONLY around the key edges (underglow) — the cap face keeps its own colour
    const haloCol = mix(color, bright * 58 * glowK)
    const haloSoft = mix(color, bright * 34 * glowK)

    const style: CSSProperties = {
        position: 'absolute',
        inset: 0,
        borderRadius: 'inherit',
        pointerEvents: 'none',
        boxShadow: `0 0 ${(oneU * 0.13).toFixed(1)}px ${haloCol}, 0 ${(oneU * 0.05).toFixed(1)}px ${(oneU * 0.22).toFixed(1)}px ${haloSoft}`,
        mixBlendMode: 'screen',
    }

    // durations from speed (faster speed → shorter cycle)
    const cycleDur = lerp(15, 2.6, speed)
    const breatheDur = lerp(6.5, 1.5, speed)
    const waveDur = lerp(5.5, 1.6, speed)
    const twinkleDur = lerp(4.2, 1.3, speed)

    if (e === 'breathe') {
        style.animation = `klBreathe ${breatheDur.toFixed(2)}s ease-in-out infinite`
    } else if (e === 'rainbow') {
        style.animation = `klHue ${cycleDur.toFixed(2)}s linear infinite`
    } else if (e === 'swirl') {
        style.animation = `klHue ${cycleDur.toFixed(2)}s linear infinite`
        style.animationDelay = `${(-((ang + 180) / 360) * cycleDur).toFixed(2)}s`
    } else if (e === 'wave') {
        style.animation = `klHue ${cycleDur.toFixed(2)}s linear infinite, klWave ${waveDur.toFixed(2)}s ease-in-out infinite`
        style.animationDelay = `0s, ${(-fx * waveDur).toFixed(2)}s`
    } else if (e === 'twinkle') {
        const seed = ((idx * 2654435761) % 1000) / 1000
        style.animation = `klTwinkle ${twinkleDur.toFixed(2)}s ease-in-out infinite`
        style.animationDelay = `${(-seed * twinkleDur).toFixed(2)}s`
    } else if (e === 'reactive') {
        // lights on press / hover, fades back to a faint ambient
        style.opacity = lit ? 1 : 0.12
        style.transition = 'opacity .28s ease'
    }
    // solid / gradient → static (no animation)

    return { style, reactive: e === 'reactive' }
}
