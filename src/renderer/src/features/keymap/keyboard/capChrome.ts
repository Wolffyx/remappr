// pattern-check: skip — pure cap-surface helpers moved out of KeyButton so keys and
// non-key controls (the encoder) share one cap, and KeyButton stays component-only
// for React fast refresh.
import type { CSSProperties } from 'react'
import type { CapStyle } from '@/stores/userSettingsStore'
import {
    catStyle,
    type ColorMode,
    heatColor,
    type KeyCategory,
} from '@/lib/keymap/keyCategory'

// pattern-check: skip — verbatim port of the design's face/chrome helpers, pure mappers
// Resolved cap-surface colours: every style consumes the same concrete set (skirt
// + face gradients, legend, edge, dot). Neutral keys use a theme-driven set so
// caps follow the active theme + light/dark mode.
export interface FaceColors {
    skirtTop: string
    skirtBot: string
    faceTop: string
    face: string
    legend: string
    edge: string
    dot: string | null
    heat: boolean
}

// Shift the lightness channel of an `oklch(L C H)` string by `delta`, clamped.
function shiftLightness(
    color: string,
    delta: number,
    lo: number,
    hi = 1,
): string {
    return color.replace(
        /oklch\(([\d.]+)/,
        (_m, l: string) =>
            `oklch(${Math.min(hi, Math.max(lo, parseFloat(l) + delta))}`,
    )
}

// Neutral (no-category) caps follow the active theme + light/dark mode via the
// CARD surface pair: `--card`/`--card-foreground` always track the mode (light
// caps in light themes, dark in dark) AND are a guaranteed-contrasting pair in
// every theme. The face is nudged toward the foreground so caps still stand out
// from the workbench background; faceTop goes toward white for the top highlight,
// skirtBot toward black for depth.
const NEUTRAL_FACES: Omit<FaceColors, 'heat'> = {
    skirtTop: 'color-mix(in oklch, var(--card) 90%, var(--foreground))',
    skirtBot: 'color-mix(in oklch, var(--card) 88%, #000)',
    faceTop: 'color-mix(in oklch, var(--card) 86%, #fff)',
    face: 'color-mix(in oklch, var(--card) 90%, var(--foreground))',
    legend: 'var(--card-foreground)',
    edge: 'var(--border)',
    dot: null,
}

function resolveFaceColors(
    category: KeyCategory,
    colorMode: ColorMode,
    heat: number | null | undefined,
): FaceColors {
    if (heat != null) {
        const hc = heatColor(heat)
        return {
            skirtTop: hc.face,
            skirtBot: shiftLightness(hc.face, -0.06, 0.12),
            faceTop: shiftLightness(hc.face, 0.05, 0, 0.8),
            face: hc.face,
            legend: 'oklch(0.98 0 0)',
            edge: hc.edge,
            dot: null,
            heat: true,
        }
    }
    const cs = catStyle(category, colorMode)
    if (!cs.face) return { ...NEUTRAL_FACES, heat: false }
    return {
        skirtTop: cs.face,
        // color-mix (not shiftLightness) so it still darkens when the face is a
        // CSS-var-based oklch (its lightness isn't a literal to regex-shift).
        skirtBot: `color-mix(in oklch, ${cs.face} 88%, #000)`,
        faceTop: cs.faceTop ?? cs.face,
        face: cs.face,
        legend: cs.legend,
        edge: cs.edge ?? NEUTRAL_FACES.edge,
        dot: cs.dot,
        heat: false,
    }
}

export interface CapChrome {
    /** Tailwind classes applied to the cap button. */
    className: string
    /** Inline style for the skirt surface. */
    style: CSSProperties
    /** Sculpted "lit face" element rendered above the skirt. */
    face?: CSSProperties
    /** Left accent bar (mono style). */
    accentBar?: CSSProperties
    /** Position/padding for the content layer (header + body). */
    content: CSSProperties
    mono: boolean
}

// One builder per cap style. Geometry follows the RKey design (rad = 0.16U,
// faceRad = 0.115U, inner face inset, content padding); surfaces stay theme-aware
// through the FaceColors above.
const CAP_CHROME: Record<
    'flat' | 'sculpted' | 'mono' | 'glass',
    (F: FaceColors, oneU: number) => CapChrome
> = {
    flat: (F, oneU) => ({
        className: '',
        style: {
            borderRadius: Math.max(5, Math.round(oneU * 0.16)),
            background: F.heat
                ? F.face
                : `linear-gradient(180deg, ${F.faceTop}, ${F.face})`,
            border: `1px solid ${F.heat ? F.edge : 'var(--border)'}`,
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,.05)',
        },
        content: { inset: 0, padding: oneU * 0.115 },
        mono: false,
    }),
    sculpted: (F, oneU) => {
        const rad = Math.max(5, Math.round(oneU * 0.16))
        const faceRad = Math.max(4, Math.round(oneU * 0.115))
        return {
            className: '',
            style: {
                borderRadius: rad,
                background: `linear-gradient(180deg, ${F.skirtTop}, ${F.skirtBot})`,
                boxShadow: `0 ${oneU * 0.05}px ${oneU * 0.11}px rgba(0,0,0,.5), inset 0 1px 0 rgba(255,255,255,.06)`,
            },
            face: {
                position: 'absolute',
                top: oneU * 0.05,
                left: oneU * 0.055,
                right: oneU * 0.055,
                bottom: oneU * 0.11,
                borderRadius: faceRad,
                background: F.heat
                    ? F.face
                    : `linear-gradient(180deg, ${F.faceTop}, ${F.face})`,
                boxShadow:
                    'inset 0 1px 0 rgba(255,255,255,.07), 0 1px 2px rgba(0,0,0,.3)',
            },
            content: {
                top: oneU * 0.065,
                left: oneU * 0.085,
                right: oneU * 0.085,
                bottom: oneU * 0.125,
            },
            mono: false,
        }
    },
    mono: (F, oneU) => ({
        className: '',
        style: {
            borderRadius: Math.max(4, Math.round(oneU * 0.12)),
            background: F.heat ? F.face : 'oklch(0.245 0 0)',
            border: '1px solid var(--border)',
            overflow: 'hidden',
        },
        accentBar:
            F.heat || !F.dot
                ? undefined
                : {
                      position: 'absolute',
                      left: 0,
                      top: 0,
                      bottom: 0,
                      width: Math.max(2, oneU * 0.06),
                      background: F.edge,
                      borderRadius: '3px 0 0 3px',
                  },
        content: { inset: 0, padding: oneU * 0.1, paddingLeft: oneU * 0.2 },
        mono: true,
    }),
    glass: (F, oneU) => ({
        className: '',
        style: {
            borderRadius: Math.max(5, Math.round(oneU * 0.16)),
            background: F.heat
                ? F.face
                : `linear-gradient(160deg, color-mix(in oklch, ${F.faceTop} 70%, transparent), color-mix(in oklch, ${F.face} 46%, transparent))`,
            border: `1px solid color-mix(in oklch, ${F.edge} 60%, transparent)`,
            backdropFilter: 'blur(6px)',
            boxShadow:
                'inset 0 1px 0 rgba(255,255,255,.18), 0 6px 18px rgba(0,0,0,.32)',
        },
        content: { inset: 0, padding: oneU * 0.11 },
        mono: false,
    }),
}

/** The cap surface a key draws: resolved face colours + the chrome for the
 *  active cap style. Shared with non-key controls (the encoder) so they sit on
 *  exactly the same cap as the keys around them. */
export function capSurface(
    capStyle: CapStyle,
    category: KeyCategory,
    colorMode: ColorMode,
    oneU: number,
    heat?: number | null,
): { F: FaceColors; chrome: CapChrome } {
    const F = resolveFaceColors(category, colorMode, heat)
    return { F, chrome: CAP_CHROME[capStyle](F, oneU) }
}

/** The selected-key ring, stacked over a cap's own chrome. */
export function selectionRing(oneU: number): CSSProperties {
    return {
        boxShadow: `0 0 0 2px var(--background), 0 0 0 4px var(--primary), 0 0 ${oneU * 0.5}px color-mix(in oklch, var(--primary) 55%, transparent)`,
    }
}
