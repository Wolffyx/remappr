// Pattern check: no GoF pattern (-) — rejected — presentational component reusing the shared capSurface/selectionRing helpers.
//
// A rotary encoder on the board — the Keycap System "REncoder" anatomy on the
// SAME cap as the keys around it (cap style, face tint, selection ring all come
// from capChrome's capSurface), so a knob reads as part of the board rather than
// a separate widget. HEADER (binding type) on top like a key, the raised knob
// where a key's legend sits, and the turn values — icon when the action has one,
// else text — at the rim they turn toward (counter-clockwise left, clockwise
// right), tinted by function. The arcs carry the direction, so no ↺/↻ glyphs.
//
// Editing: the cap is split into one invisible hit zone per direction (the
// side each sits on comes from ENCODER_DIRS), each carrying `data-encoder`
// (encoderHitId), so the board's delegated click handler picks a direction. The
// selected direction lights its arc + value and turns the pointer toward it.
import { Fragment, memo } from 'react'
import {
    CATEGORY_META,
    catStyle,
    type ColorMode,
    type KeyCategory,
} from '@/lib/keymap/keyCategory'
import type { CapStyle, KeyDisplayMode } from '@/stores/userSettingsStore'
import type { KnobLegend } from '@/features/encoders/knobLegend'
import {
    dirInfo,
    ENCODER_DIRS,
    type EncoderDir,
    encoderHitId,
} from '@/features/encoders/model'
import { capSurface, selectionRing } from './capChrome'
import { LegendParts } from './LegendParts'
import { legendIcon } from './legendIcons'

interface EncoderCapProps {
    knob: KnobLegend
    /** Footprint in U (square at 1×1). */
    width: number
    height: number
    oneU: number
    /** Which direction is selected for editing, if this knob is selected. */
    selectedDir: EncoderDir | null
    capStyle: CapStyle
    colorMode: ColorMode
    keyDisplayMode: KeyDisplayMode
    showHeaderTag?: boolean
}

/** Rim arc per cap side, in degrees: [from, to, SVG sweep flag]. */
const ARC: Record<'left' | 'right', [number, number, 0 | 1]> = {
    left: [205, 150, 0],
    right: [-25, 30, 1],
}

/** Pointer tilt toward the direction being edited, in degrees. */
const TILT = 32

const EncoderCapImpl = ({
    knob,
    width,
    height,
    oneU,
    selectedDir,
    capStyle,
    colorMode,
    keyDisplayMode,
    showHeaderTag = true,
}: EncoderCapProps): JSX.Element => {
    const S = oneU
    // Same footprint rule as a key (makeSize): 2px gutter.
    const W = width * S - 2
    const H = height * S - 2
    // The knob's function colour follows its turn actions: the right-most
    // bound, non-alpha one wins (cw first), else the left-most.
    const sides = ENCODER_DIRS.map(({ dir }) => knob[dir])
    const kind: KeyCategory = (
        [...sides]
            .reverse()
            .find((side) => side.text && side.category !== 'alpha') ?? sides[0]
    ).category
    const { F, chrome } = capSurface(capStyle, kind, colorMode, S)
    const accent =
        colorMode !== 'off' && CATEGORY_META[kind]?.hue != null
            ? catStyle(kind, colorMode)
            : null
    const ink = accent?.legend ?? F.legend
    const edge = accent?.edge ?? F.edge

    // Knob + arcs, centred on the face between the header row and the rim labels.
    const D = Math.min(W, H) * 0.5
    const cx = W / 2
    const cy = H * 0.48
    const r = D / 2 + S * 0.045
    const pt = (deg: number): [number, number] => [
        cx + r * Math.cos((deg * Math.PI) / 180),
        cy + r * Math.sin((deg * Math.PI) / 180),
    ]
    const arc = (a1: number, a2: number, sweep: 0 | 1): string => {
        const [x1, y1] = pt(a1)
        const [x2, y2] = pt(a2)
        return `M${x1} ${y1} A${r} ${r} 0 0 ${sweep} ${x2} ${y2}`
    }
    const selected = selectedDir !== null
    const lit = (d: EncoderDir): boolean => selectedDir === d
    const arrowCol = (d: EncoderDir): string =>
        lit(d) ? ink : `color-mix(in oklch, ${edge} 55%, transparent)`
    const marker = `enc-arr-${knob.slot}`
    const stroke = Math.max(1.5, S * 0.016)
    const angle = !selectedDir
        ? 0
        : dirInfo(selectedDir).side === 'right'
          ? TILT
          : -TILT

    // Key type scale (KeyButton): header 0.098U, rim values at the hold size.
    const headerSize = Math.max(8, Math.round(S * 0.098))
    const lblSize = Math.max(8, Math.round(S * 0.108))
    // An icon reads at the knob's rim values' cap height, a touch larger.
    const iconSize = Math.max(10, Math.round(S * 0.15))
    const headerHidden = !showHeaderTag || keyDisplayMode === 'hidden'
    const isBindingMode = keyDisplayMode === 'binding'
    const headerColor = accent
        ? `color-mix(in oklch, ${accent.legend} 92%, transparent)`
        : 'color-mix(in oklch, var(--foreground) 44%, transparent)'

    const dirLabel = (d: EncoderDir): JSX.Element => {
        const side = knob[d]
        const on = lit(d)
        const sideInk =
            side.text && colorMode !== 'off'
                ? (catStyle(side.category, colorMode).legend ?? F.legend)
                : F.legend
        return (
            <span
                title={side.title ?? side.text}
                className="font-keycap"
                style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    minWidth: 0,
                    maxWidth: '50%',
                    fontSize: lblSize,
                    fontWeight: 700,
                    lineHeight: 1,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    color: side.text ? sideInk : 'var(--muted-foreground)',
                    opacity: selected && !on ? 0.45 : 1,
                    transition: 'opacity .15s',
                }}
            >
                {side.parts ? (
                    <span
                        style={{
                            // Icon-only reads larger; icon + text shares the
                            // rim size so both fit the half-cap.
                            fontSize: side.parts.every(
                                (p) => legendIcon(p.icon) || !p.text,
                            )
                                ? iconSize
                                : lblSize,
                            lineHeight: 1,
                            minWidth: 0,
                            overflow: 'hidden',
                        }}
                    >
                        <LegendParts parts={side.parts} title={side.title} />
                    </span>
                ) : (
                    <span style={{ overflow: 'hidden' }}>
                        {side.text || '—'}
                    </span>
                )}
            </span>
        )
    }

    // Knob surfaces derived from the cap face, so the knob follows the key's
    // tint and theme: a contrasting ridged grip and a lit dome.
    const gripLight = `color-mix(in oklch, ${F.face} 62%, ${F.legend})`
    const gripDark = `color-mix(in oklch, ${F.face} 78%, #000)`
    const domeLight = `color-mix(in oklch, ${F.faceTop} 78%, #fff)`
    const domeDark = `color-mix(in oklch, ${F.face} 88%, #000)`

    return (
        <div style={{ position: 'relative', width: W, height: H }}>
            {/* the key's own cap: style, face tint, selection ring */}
            <div
                aria-hidden
                style={{
                    position: 'absolute',
                    inset: 0,
                    ...chrome.style,
                    ...(selected ? selectionRing(S) : {}),
                }}
            >
                {chrome.face && <div style={chrome.face} />}
                {chrome.accentBar && <div style={chrome.accentBar} />}
            </div>
            {/* header + rim values sit in the key's content box */}
            <div
                className="absolute flex flex-col justify-between"
                style={{ ...chrome.content, pointerEvents: 'none' }}
            >
                <div
                    className="flex items-center leading-none"
                    style={{ height: S * 0.15, flexShrink: 0 }}
                >
                    {headerHidden ? null : (
                        <span
                            className={`leading-none whitespace-nowrap overflow-hidden ${
                                chrome.mono || isBindingMode
                                    ? 'font-mono uppercase'
                                    : 'font-keycap'
                            }`}
                            style={{
                                fontSize: headerSize,
                                fontWeight: 700,
                                letterSpacing:
                                    chrome.mono || isBindingMode
                                        ? '.04em'
                                        : '.02em',
                                color: headerColor,
                            }}
                        >
                            {isBindingMode ? 'ENC' : 'Encoder'}
                        </span>
                    )}
                </div>
                <div
                    className="flex items-center justify-between"
                    style={{ gap: S * 0.04 }}
                >
                    {ENCODER_DIRS.map(({ dir }) => (
                        <Fragment key={dir}>{dirLabel(dir)}</Fragment>
                    ))}
                </div>
            </div>
            <svg
                width={W}
                height={H}
                style={{
                    position: 'absolute',
                    inset: 0,
                    overflow: 'visible',
                    pointerEvents: 'none',
                }}
            >
                <defs>
                    {ENCODER_DIRS.map(({ dir: d }) => (
                        <marker
                            key={d}
                            id={`${marker}-${d}`}
                            viewBox="0 0 10 10"
                            refX="5"
                            refY="5"
                            markerWidth="4"
                            markerHeight="4"
                            orient="auto-start-reverse"
                        >
                            <path d="M0 0 L10 5 L0 10 z" fill={arrowCol(d)} />
                        </marker>
                    ))}
                </defs>
                {ENCODER_DIRS.map(({ dir, side }) => (
                    <path
                        key={dir}
                        d={arc(...ARC[side])}
                        fill="none"
                        stroke={arrowCol(dir)}
                        strokeWidth={stroke}
                        strokeLinecap="round"
                        markerEnd={`url(#${marker}-${dir})`}
                    />
                ))}
            </svg>
            {/* knob — the design's raised knob (ridged grip, lit dome,
                glowing pointer), coloured from the cap so it sits on the key */}
            <div
                style={{
                    position: 'absolute',
                    left: cx - D / 2,
                    top: cy - D / 2,
                    width: D,
                    height: D,
                    borderRadius: '50%',
                    pointerEvents: 'none',
                    boxShadow: `0 ${S * 0.025}px ${S * 0.05}px rgba(0,0,0,.4)`,
                }}
            >
                <div
                    style={{
                        position: 'absolute',
                        inset: 0,
                        borderRadius: '50%',
                        transform: `rotate(${angle}deg)`,
                        transition: 'transform .25s ease',
                        background: `repeating-conic-gradient(${gripLight} 0 5deg, ${gripDark} 5deg 10deg)`,
                    }}
                />
                <div
                    style={{
                        position: 'absolute',
                        inset: D * 0.1,
                        borderRadius: '50%',
                        background: `radial-gradient(circle at 38% 30%, ${domeLight}, ${domeDark} 72%)`,
                        boxShadow: `inset 0 1px 0 rgba(255,255,255,.12), inset 0 -2px 4px rgba(0,0,0,.3), 0 0 0 1px ${gripDark}`,
                    }}
                />
                <div
                    style={{
                        position: 'absolute',
                        inset: D * 0.1,
                        transform: `rotate(${angle}deg)`,
                        transition: 'transform .25s ease',
                    }}
                >
                    <div
                        style={{
                            position: 'absolute',
                            left: '50%',
                            top: D * 0.05,
                            width: Math.max(2, D * 0.045),
                            height: D * 0.11,
                            marginLeft: -Math.max(2, D * 0.045) / 2,
                            borderRadius: 99,
                            background: ink,
                            boxShadow: `0 0 ${D * 0.08}px ${edge}`,
                        }}
                    />
                </div>
                {/* no press binding in the encoder model — the design's empty centre */}
                <div
                    style={{
                        position: 'absolute',
                        inset: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        paddingTop: D * 0.06,
                    }}
                >
                    <span
                        style={{
                            width: D * 0.1,
                            height: D * 0.1,
                            borderRadius: '50%',
                            background: gripDark,
                            boxShadow: 'inset 0 1px 2px rgba(0,0,0,.6)',
                        }}
                    />
                </div>
            </div>
            {/* Hit zones — the board's delegated click reads data-encoder. */}
            {ENCODER_DIRS.map(({ dir, long, side }) => (
                <div
                    key={dir}
                    role="button"
                    tabIndex={0}
                    data-key="true"
                    data-encoder={encoderHitId({ slot: knob.slot, dir })}
                    aria-label={`Encoder ${knob.slot + 1} ${long.toLowerCase()}: ${knob[dir].title || knob[dir].text || 'unbound'}`}
                    style={{
                        position: 'absolute',
                        top: 0,
                        bottom: 0,
                        left: side === 'left' ? 0 : '50%',
                        right: side === 'left' ? '50%' : 0,
                        cursor: 'pointer',
                    }}
                />
            ))}
        </div>
    )
}

export const EncoderCap = memo(EncoderCapImpl)
