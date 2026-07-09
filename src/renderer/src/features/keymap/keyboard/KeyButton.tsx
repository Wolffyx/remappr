// Pattern check: Strategy (Tier 1) — extended — per-cap-style chrome (flat/sculpted/mono/
// glass) is chosen at runtime from a style-builder map keyed by capStyle; each builder
// produces its own skirt/face/content geometry behind one CapChrome interface.
//
// Anatomy ported from the "Unified Keycap" (RKey) design: header top-left, a
// centred legend, modifier CHIPS stacked above the legend for chords (joined by
// "+"), and a tap-hold split into TAP + a "HOLD" eyebrow zone divided by a tinted
// rule. The cap surfaces stay THEME-AWARE (FaceColors below) rather than RKey's
// fixed grey, so caps still follow the active theme + light/dark mode.
import { CSSProperties, memo, PropsWithChildren } from 'react'
import { type HoldTapLabels, type KeyCapLegend } from './keyCapLegend'
import { KeyLight } from '@/features/lighting/KeyLight'
import type { KeyLightInput } from '@/features/lighting/engine'
import { glyphNode } from './keyGlyph'
import { LegendParts } from './LegendParts'
import { hasResolvableIcon, legendPartsLength } from './legendIcons'
import useUserSettingsStore, {
    type CapStyle,
    type KeyDisplayMode,
} from '@/stores/userSettingsStore'
import useConnectionStore from '@/stores/connectionStore'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/ui/tooltip'
import {
    CATEGORY_META,
    catStyle,
    type ColorMode,
    heatColor,
    type KeyCategory,
} from '@/lib/keymap/keyCategory'

export type { HoldTapLabels }

// Modifier name → glyph, matching the RKey design's MODS table. Names arrive from
// the binding mappers (e.g. builderCapProps' MOD_SHORT: "Ctrl"/"Shift"/"Gui").
const MOD_GLYPH: Record<string, string> = {
    Ctrl: '⌃',
    Control: '⌃',
    Shift: '⇧',
    Alt: '⌥',
    Opt: '⌥',
    Option: '⌥',
    Gui: '◆',
    Super: '◆',
    Win: '◆',
    Meta: '◆',
    Cmd: '⌘',
}

// pattern-check: skip — additive optional props on existing KeyButtonProps interface
// The legend fields (header/tapText/actionLabel/holdTap/mods/shift/category/
// accentCategory) come from the shared KeyCapLegend contract; KeyButtonProps adds
// layout (width/oneU…) and interaction (selected/pressed/onClick) on top.
interface KeyButtonProps extends KeyCapLegend {
    selected?: boolean
    /** Part of an active multi-selection (distinct accent ring from `selected`). */
    multiSelected?: boolean
    pressed?: boolean
    /** Key Test: pressed at least once this sweep — persistent "tested" ring. */
    seen?: boolean
    width: number
    height: number
    oneU: number
    hoverZoom?: boolean
    /** Which edge the TAP legend sits on for a tap-hold; "top" (default) puts the
     *  tap above the HOLD zone, "bottom" flips them. */
    tapPos?: 'top' | 'bottom'
    /** Normalised press intensity 0–1 for the heatmap overlay, or null when off. */
    heat?: number | null
    /** Raw lifetime press count, surfaced in the rich tooltip when the heatmap is on. */
    pressCount?: number | null
    /** Render a rich hover tooltip (tap/action/hold/type/press-count). */
    richTooltip?: boolean
    /** Force a cap style (e.g. settings previews); defaults to the user setting. */
    capStyleOverride?: CapStyle
    /** Force a colour-coding intensity; defaults to the user setting. */
    colorModeOverride?: ColorMode
    /** Hide the action-type tag (top-left) — used by small, clean previews. */
    showHeaderTag?: boolean
    /** Hide the category dot (top-right) — used by small, clean previews. */
    showCategoryDot?: boolean
    /** RGB-simulation glow input (cfg + normalized key centre + index). When set
     *  and enabled, a <KeyLight> underglow layer renders above the face. Skipped
     *  automatically while the heatmap is coloring the cap. */
    light?: KeyLightInput | null
    onClick?: () => void
}

interface KeyDimension {
    width: number
    height: number
}

function makeSize(
    { width, height }: KeyDimension,
    oneU: number,
): CSSProperties {
    width *= oneU
    height *= oneU

    return {
        '--key-center-width': 'calc(' + width + 'px - 2px)',
        width: 'calc(' + width + 'px - 2px)',
        '--key-center-height': 'calc(' + height + 'px - 2px)',
        height: 'calc(' + height + 'px - 2px)',
    } as CSSProperties
}

// pattern-check: skip — verbatim port of the design's face/chrome helpers, pure mappers
// Resolved cap-surface colours: every style consumes the same concrete set (skirt
// + face gradients, legend, edge, dot). Neutral keys use a theme-driven set so
// caps follow the active theme + light/dark mode.
interface FaceColors {
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

interface CapChrome {
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

// View props: the four store-derived values (capStyle/colorMode/keyDisplayMode) arrive
// resolved from the caller instead of being read per-key, so 100 keys don't each
// subscribe to the connection + user-settings stores. The thin `KeyButton` wrapper
// below preserves the original store-reading API for standalone callers.
interface KeyButtonViewProps extends Omit<
    KeyButtonProps,
    'capStyleOverride' | 'colorModeOverride'
> {
    capStyle: CapStyle
    colorMode: ColorMode
    keyDisplayMode: KeyDisplayMode
}

const KeyButtonViewImpl = ({
    selected = false,
    multiSelected = false,
    pressed = false,
    seen = false,
    header,
    tapText,
    tapParts,
    valueTitle,
    actionLabel,
    oneU,
    hoverZoom = true,
    holdTap,
    mods,
    shift,
    tapPos = 'top',
    category = 'alpha',
    accentCategory,
    heat = null,
    pressCount = null,
    richTooltip = false,
    capStyle,
    colorMode,
    keyDisplayMode,
    showHeaderTag = true,
    showCategoryDot = true,
    light = null,
    ...props
}: PropsWithChildren<KeyButtonViewProps>): JSX.Element => {
    const size = makeSize(props, oneU)
    const S = oneU

    // Type ramp, ported from the design reference: a plain tap legend fills 0.46U,
    // a 2–3 char tap shrinks to 0.34U, longer to 0.24U. A tap that shares the cap
    // with a HOLD zone or modifier chips uses the reference's 0.30U key (0.22U for
    // longer text) — small enough to clear the divider, matching the mockup.
    const iconParts = hasResolvableIcon(tapParts) ? tapParts : undefined
    const tapLen = iconParts
        ? legendPartsLength(iconParts)
        : tapText
          ? tapText.length
          : typeof props.children === 'string'
            ? props.children.length
            : 1
    const crowded = !!holdTap || !!(mods && mods.length)
    const mainSize = Math.max(
        11,
        Math.round(
            S *
                (crowded
                    ? tapLen > 2
                        ? 0.22
                        : 0.3
                    : tapLen > 3
                      ? 0.24
                      : tapLen > 1
                        ? 0.34
                        : 0.46),
        ),
    )
    const headerSize = Math.max(8, Math.round(S * 0.098))
    // Chip + HOLD metrics matched 1:1 to the design reference (--u = oneU). Low
    // px floors only (legibility on tiny previews) — kept small so the HOLD zone
    // stays proportional on editor-scale caps and short layer names don't truncate.
    const eyebrow = Math.max(5, Math.round(S * 0.088))
    const holdSize = Math.max(7, Math.round(S * 0.142))
    const chipGlyph = Math.round(S * 0.112)
    const chipLabel = Math.max(8, Math.round(S * 0.1))
    const plusSize = Math.round(S * 0.128)
    const shiftSize = Math.round(S * 0.13)

    const headerHidden = keyDisplayMode === 'hidden'
    const effectiveHeader =
        keyDisplayMode === 'binding' && actionLabel ? actionLabel : header
    const isBindingMode = keyDisplayMode === 'binding' && !!actionLabel

    const tooltipParts = [
        header,
        actionLabel ? `(${actionLabel})` : '',
        holdTap?.tooltip,
    ].filter(Boolean)
    const tooltip = tooltipParts.join(' — ')

    // Rich-tooltip rows (label → value); only non-empty rows render. Show the
    // full breakdown of the binding rather than a single mislabelled line.
    const tipRows: Array<[string, string]> = []
    if (holdTap?.tooltip) {
        // A tap-hold's tooltip already reads "<Action>\nTap: ..\nHold: ..";
        // split it into labelled rows (first line = the action-type name).
        holdTap.tooltip.split('\n').forEach((line, i) => {
            const sep = line.indexOf(': ')
            if (sep > 0) tipRows.push([line.slice(0, sep), line.slice(sep + 2)])
            else if (i === 0 && line) tipRows.push(['Action', line])
        })
    } else {
        // Header is the behaviour/action name (e.g. "To Layer", "Bluetooth",
        // "Macro"); tapText is its value glyph/legend (e.g. "L4", "BT 0",
        // "m_hello", "Q"). Both together read as the full key.
        if (header) tipRows.push(['Action', header])
        // Prefer the full, untruncated value (valueTitle) — the cap legend may be
        // an abbreviated glyph (e.g. "Erro…") while the tooltip shows it whole.
        const valueText = valueTitle ?? tapText
        if (valueText && valueText !== header && valueText !== '▽')
            tipRows.push(['Value', valueText])
        if (actionLabel) tipRows.push(['Binding', actionLabel])
    }
    const typeLabel = CATEGORY_META[category]?.label
    if (typeLabel) tipRows.push(['Type', typeLabel])
    if (pressCount != null) tipRows.push(['Presses', String(pressCount)])

    const F = resolveFaceColors(category, colorMode, heat)
    const chrome = CAP_CHROME[capStyle](F, oneU)
    const sculpted = capStyle === 'sculpted'

    // Outer border-radius for the underglow layer, matched per cap style so the
    // glow tracks the skirt edge. Skipped while the heatmap is coloring the cap.
    const lightRad =
        capStyle === 'sculpted' || capStyle === 'glass'
            ? Math.max(5, Math.round(oneU * 0.16))
            : capStyle === 'mono'
              ? Math.max(4, Math.round(oneU * 0.11))
              : Math.max(4, Math.round(oneU * 0.12))
    const lightEl =
        light && light.cfg.enabled && heat == null ? (
            <KeyLight
                cfg={light.cfg}
                fx={light.fx}
                fy={light.fy}
                idx={light.idx}
                oneU={oneU}
                radius={lightRad}
                lit={pressed}
                color={light.color}
            />
        ) : null
    const showDot = showCategoryDot && !!F.dot && !F.heat && !shift

    // Accent colour (header tag + hold legend + chips). Falls back to the face
    // category. Only categories with a hue tint the text; alpha/space and `off`
    // mode leave it neutral — so a home-row mod's header is violet while its cap
    // face stays grey.
    const accentCat = accentCategory ?? category
    const accentColored =
        colorMode !== 'off' && CATEGORY_META[accentCat]?.hue != null
    const accentStyle = accentColored ? catStyle(accentCat, colorMode) : null
    const accentLegend = accentStyle?.legend ?? null
    const accentEdge = accentStyle?.edge ?? F.edge

    // Selected ring + pressed (live) state stack on top of the cap chrome.
    const ringStyle: CSSProperties = selected
        ? {
              boxShadow: `0 0 0 2px var(--background), 0 0 0 4px var(--primary), 0 0 ${oneU * 0.5}px color-mix(in oklch, var(--primary) 55%, transparent)`,
          }
        : multiSelected
          ? {
                boxShadow: `0 0 0 2px var(--background), 0 0 0 3px color-mix(in oklch, var(--primary) 70%, transparent)`,
            }
          : {}
    const pressedStyle: CSSProperties = pressed
        ? {
              background:
                  'linear-gradient(180deg, oklch(0.72 0.18 150), oklch(0.6 0.18 150))',
              boxShadow: `0 0 ${oneU * 0.6}px color-mix(in oklch, oklch(0.7 0.2 150) 70%, transparent)`,
          }
        : {}

    // Key Test "tested" ring: persistent green outline for keys already seen this
    // sweep. Suppressed while actively pressed (the flash takes over) or selected.
    const seenStyle: CSSProperties =
        seen && !pressed && !selected && !multiSelected
            ? {
                  boxShadow:
                      'inset 0 0 0 2px color-mix(in oklch, oklch(0.7 0.18 150) 80%, transparent)',
              }
            : {}

    const legendColor = pressed ? '#fff' : F.legend
    const headerColor = pressed
        ? 'rgba(255,255,255,.82)'
        : F.heat
          ? 'rgba(255,255,255,.78)'
          : accentLegend
            ? `color-mix(in oklch, ${accentLegend} 92%, transparent)`
            : 'color-mix(in oklch, var(--foreground) 44%, transparent)'

    // pattern-check: skip — render-body restructure (compose chips + tap-hold), no new abstraction
    const tapTop = tapPos !== 'bottom'
    const tapNode = holdTap ? (
        holdTap.tap
    ) : iconParts ? (
        <LegendParts parts={iconParts} title={valueTitle ?? tapText} />
    ) : (
        props.children
    )
    const hasChips = !!(mods && mods.length)

    // Modifier chips (chord) — rendered ABOVE the tap legend, joined by "+".
    // Compose WITH a tap-hold (design's "mod-tap + chord": chips + tap + HOLD).
    const chipInk = accentLegend ?? F.legend
    const chipBg = `color-mix(in oklch, ${accentEdge} 26%, var(--card))`
    const labeledChip = !!mods && mods.length === 1
    const chipsRow = hasChips ? (
        <div
            className="flex shrink-0 items-center justify-center"
            style={{ gap: S * 0.03 }}
        >
            {mods!.map((name, i) => (
                <span
                    key={i}
                    style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: S * 0.022,
                        padding: `${S * 0.012}px ${labeledChip ? S * 0.05 : S * 0.035}px`,
                        borderRadius: 99,
                        background: chipBg,
                        color: chipInk,
                        border: `1px solid color-mix(in oklch, ${accentEdge} 45%, transparent)`,
                        lineHeight: 1,
                    }}
                >
                    <span style={{ fontSize: chipGlyph, lineHeight: 1 }}>
                        {MOD_GLYPH[name] ?? name}
                    </span>
                    {labeledChip ? (
                        <span
                            style={{
                                fontSize: chipLabel,
                                fontWeight: 700,
                                letterSpacing: '.02em',
                            }}
                        >
                            {name}
                        </span>
                    ) : null}
                </span>
            ))}
            <span
                style={{
                    fontSize: plusSize,
                    color: 'color-mix(in oklch, var(--foreground) 55%, transparent)',
                    fontWeight: 600,
                }}
            >
                +
            </span>
        </div>
    ) : null

    // Tap group = optional chips + the tap legend, filling the open area and
    // centred (design `.keycap__tap`: flex-1, column, centred, gap 0.02U). The
    // 0.30U crowded key + this centering keeps the glyph clear of the divider.
    const tapGroup = (
        <div
            className="flex min-h-0 flex-1 flex-col items-center justify-center"
            style={{ gap: hasChips ? S * 0.02 : 0 }}
        >
            {chipsRow}
            <span
                className={`flex items-center justify-center leading-none ${chrome.mono ? 'font-mono' : 'font-keycap'}`}
                style={{
                    fontSize: mainSize,
                    lineHeight: 1,
                    maxWidth: '100%',
                    color: legendColor,
                    fontWeight: chrome.mono ? 600 : 700,
                    letterSpacing: tapLen > 2 ? '-.01em' : 0,
                    textShadow:
                        sculpted && !F.heat
                            ? '0 1px 1px rgba(0,0,0,.35)'
                            : 'none',
                }}
            >
                {/* Substitute a Lucide icon for the bad-metric space glyph (builder
                    passes the glyph as a string; the editor's HidUsageLabel already
                    substitutes internally). */}
                {typeof tapNode === 'string' ? glyphNode(tapNode) : tapNode}
            </span>
        </div>
    )

    // ── body: tap group (+chips) optionally split by a HOLD zone ────────────
    let body: React.ReactNode
    if (holdTap) {
        const holdStr =
            typeof holdTap.hold === 'string' ? holdTap.hold : undefined
        const hg = holdStr ? MOD_GLYPH[holdStr] : undefined
        const holdTone = pressed
            ? 'rgba(255,255,255,.85)'
            : (accentLegend ?? F.legend)
        // The "HOLD" eyebrow + value sit side-by-side per the design. On small
        // editor caps (≲100px) a wide layer name ("lower") would push the value
        // into an ellipsis, so the eyebrow is dropped there and the value alone is
        // shown (still clearly the hold, by colour + position); big picker/inspector
        // caps keep the full reference layout.
        const showEyebrow = S >= 100
        const holdZone = (
            <div
                key="h"
                className="flex items-baseline justify-center max-w-full overflow-hidden"
                style={{
                    flexShrink: 0,
                    gap: S * 0.05,
                    paddingTop: tapTop ? S * 0.05 : 0,
                    paddingBottom: tapTop ? 0 : S * 0.05,
                }}
            >
                {showEyebrow ? (
                    <span
                        className="font-keycap shrink-0"
                        style={{
                            fontSize: eyebrow,
                            fontWeight: 700,
                            letterSpacing: '.12em',
                            color: `color-mix(in oklch, ${holdTone} 62%, transparent)`,
                        }}
                    >
                        HOLD
                    </span>
                ) : null}
                <span
                    className={`leading-none min-w-0 ${chrome.mono ? 'font-mono' : 'font-keycap'} overflow-hidden text-ellipsis whitespace-nowrap`}
                    style={{
                        fontSize: holdSize,
                        fontWeight: 700,
                        color: holdTone,
                    }}
                >
                    {hg ? `${hg} ${holdStr}` : holdTap.hold}
                </span>
            </div>
        )
        const divider = (
            <div
                key="d"
                style={{
                    height: 1,
                    alignSelf: 'stretch',
                    margin: `0 ${S * 0.03}px`,
                    background: `color-mix(in oklch, ${accentEdge} 38%, transparent)`,
                }}
            />
        )
        body = tapTop ? (
            <>
                {tapGroup}
                {divider}
                {holdZone}
            </>
        ) : (
            <>
                {holdZone}
                {divider}
                {tapGroup}
            </>
        )
    } else {
        body = tapGroup
    }

    const buttonEl = (
        <button
            type="button"
            aria-pressed={selected}
            data-zoomer={hoverZoom}
            title={richTooltip ? undefined : tooltip || undefined}
            style={{
                ...chrome.style,
                ...seenStyle,
                ...pressedStyle,
                ...ringStyle,
            }}
            className={`relative transition-[box-shadow] duration-100 box-border text-secondary-foreground grow flex flex-col items-center justify-center w-full h-full ${chrome.className} ${
                pressed ? 'text-white translate-y-[2px]' : ''
            }`}
        >
            {chrome.face && !pressed && <div style={chrome.face} aria-hidden />}
            {chrome.accentBar && <div style={chrome.accentBar} aria-hidden />}
            {/* RGB-simulation underglow (above the face, below the legend) */}
            {lightEl}
            {/* content layer (sits inside the lit face for sculpted) */}
            <div className="absolute flex flex-col" style={chrome.content}>
                {/* header / shift-or-dot row */}
                <div
                    className="flex items-center justify-between leading-none"
                    style={{ height: S * 0.15, flexShrink: 0 }}
                >
                    {showHeaderTag && !headerHidden && effectiveHeader ? (
                        <span
                            className={`leading-none whitespace-nowrap overflow-hidden ${
                                chrome.mono || isBindingMode
                                    ? 'font-mono uppercase'
                                    : 'font-keycap'
                            }`}
                            style={{
                                fontSize: `${headerSize}px`,
                                fontWeight: 700,
                                letterSpacing:
                                    chrome.mono || isBindingMode
                                        ? '.04em'
                                        : '.02em',
                                color: headerColor,
                            }}
                        >
                            {effectiveHeader}
                        </span>
                    ) : (
                        <span />
                    )}
                    {shift ? (
                        <span
                            style={{
                                fontSize: shiftSize,
                                fontWeight: 700,
                                lineHeight: 1,
                                color:
                                    catStyle('num', colorMode).legend ??
                                    F.legend,
                            }}
                        >
                            {shift}
                        </span>
                    ) : showDot ? (
                        <span
                            aria-hidden
                            style={{
                                width: Math.max(4, oneU * 0.09),
                                height: Math.max(4, oneU * 0.09),
                                borderRadius: 99,
                                background: F.edge,
                                flexShrink: 0,
                                boxShadow: `0 0 ${oneU * 0.12}px ${F.edge}`,
                            }}
                        />
                    ) : (
                        <span />
                    )}
                </div>

                {body}
            </div>
        </button>
    )

    return (
        <div
            // No `transition` on transform here: declaring one makes the browser
            // pre-promote every keycap to its own fixed-resolution GPU layer, so a
            // board-level zoom scales each cached bitmap (foggy text) until a hover
            // re-rasterises that one key. The hover scale stays (instant), and with
            // no per-key layers the whole board repaints crisp at any zoom.
            className={`group inline-flex flex-col items-center justify-center ${hoverZoom ? 'hover:scale-[1.06]' : ''}`}
            data-zoomer={hoverZoom}
            style={size}
            {...props}
        >
            {richTooltip && tipRows.length > 0 ? (
                <Tooltip>
                    <TooltipTrigger asChild>{buttonEl}</TooltipTrigger>
                    <TooltipContent side="top" sideOffset={6}>
                        <div className="flex flex-col gap-0.5">
                            {tipRows.map(([k, v]) => (
                                <div
                                    key={k}
                                    className="flex items-center gap-2 text-[11px] leading-tight"
                                >
                                    <span className="w-12 shrink-0 opacity-60">
                                        {k}
                                    </span>
                                    <span className="font-medium">{v}</span>
                                </div>
                            ))}
                        </div>
                    </TooltipContent>
                </Tooltip>
            ) : (
                buttonEl
            )}
        </div>
    )
}

/** Memoized presentational keycap. Canvases render this directly (resolving the
 *  cap-style / colour-mode / display-mode once for the whole board) so a parent
 *  re-render or a committed pan/zoom does not re-render every key. */
export const KeyButtonView = memo(KeyButtonViewImpl)

/** Store-reading keycap — the original public API. Resolves cap-style/colour-mode
 *  (honouring per-call overrides) + the firmware-keyed display mode from the user
 *  settings, then delegates to the memoized view. Kept for standalone callers
 *  (settings previews, inspector cards, builder) that don't lift these reads. */
export const KeyButton = (
    props: PropsWithChildren<KeyButtonProps>,
): JSX.Element => {
    const { capStyleOverride, colorModeOverride, ...rest } = props
    const firmware = useConnectionStore((s) => s.service?.deviceInfo.firmware)
    const keyDisplayModeMap = useUserSettingsStore((s) => s.keyDisplayMode)
    const capStyleSetting = useUserSettingsStore((s) => s.capStyle)
    const colorModeSetting = useUserSettingsStore((s) => s.colorMode)
    const capStyle = capStyleOverride ?? capStyleSetting
    const colorMode = colorModeOverride ?? colorModeSetting
    const keyDisplayMode =
        keyDisplayModeMap[firmware ?? '_default'] ??
        keyDisplayModeMap['_default'] ??
        'displayName'
    return (
        <KeyButtonView
            {...rest}
            capStyle={capStyle}
            colorMode={colorMode}
            keyDisplayMode={keyDisplayMode}
        />
    )
}
