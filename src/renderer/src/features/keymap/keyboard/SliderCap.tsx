// Pattern check: no GoF pattern (-) — rejected — presentational cap mirroring EncoderCap; reuses capSurface/selectionRing.
//
// A slider on the board — the same cap as the keys around it (cap style, face
// tint by what it does, selection ring from capChrome), sized in U like a key:
// tall when it slides up and down, wide when it lies flat. A groove runs along
// it with a raised thumb. Keys you pick show their up / down values at the two
// ends; a level shows its name and range. A motorized slider wears a motor
// badge and a touch ring round the thumb.
//
// Editing: each half of the cap is a hit zone with the slider's `data-idx` and
// its direction in `data-slider-dir`, so the board's delegated click selects
// the slider and the editor opens on that direction.
import { memo, type CSSProperties } from 'react'
import { Cog } from 'lucide-react'
import { catStyle, type ColorMode } from '@/lib/keymap/keyCategory'
import type { CapStyle, KeyDisplayMode } from '@/stores/userSettingsStore'
import {
    SLIDER_DIRS,
    type SliderDir,
    type SliderLegend,
} from '@/features/sliders/model'
import type { KnobSide } from '@/features/encoders/knobLegend'
import { capSurface, selectionRing } from './capChrome'
import { LegendParts } from './LegendParts'

interface SliderCapProps {
    legend: SliderLegend
    /** Footprint in U. */
    width: number
    height: number
    oneU: number
    /** The slider's keymap position (its hit zones carry it). */
    idx: number
    /** The direction being edited, if this slider is selected. */
    selectedDir: SliderDir | null
    capStyle: CapStyle
    colorMode: ColorMode
    keyDisplayMode: KeyDisplayMode
    showHeaderTag?: boolean
}

/** Where along the groove the thumb rests: a level sits part-way up, keys in the middle. */
const THUMB_AT = { level: 0.38, keys: 0.5, none: 0.5 } as const

const SliderCapImpl = ({
    legend,
    width,
    height,
    oneU,
    idx,
    selectedDir,
    capStyle,
    colorMode,
    keyDisplayMode,
    showHeaderTag = true,
}: SliderCapProps): JSX.Element => {
    const S = oneU
    const W = width * S - 2
    const H = height * S - 2
    const vertical = H >= W
    const { F, chrome } = capSurface(capStyle, legend.category, colorMode, S)
    const accent =
        colorMode !== 'off' ? catStyle(legend.category, colorMode) : null
    const ink = accent?.legend ?? F.legend
    const edge = accent?.edge ?? 'var(--primary)'
    const selected = selectedDir !== null

    const headerSize = Math.max(8, Math.round(S * 0.098))
    const valSize = Math.max(8, Math.round(S * 0.12))
    const headerHidden = !showHeaderTag || keyDisplayMode === 'hidden'

    // The groove: along the long side, inset past the header and the end values.
    const pad = S * 0.32
    // A tall slider leaves room at the top for the header and the up value.
    const lead = vertical ? S * 0.46 : pad
    const thick = Math.max(4, S * 0.09)
    const along = (vertical ? H : W) - lead - pad
    const t = THUMB_AT[legend.kind]
    // Up = top (vertical) or right (flat); the thumb's offset from that end.
    const thumbFromUp = along * t
    const groove: CSSProperties = vertical
        ? { left: W / 2 - thick / 2, top: lead, width: thick, height: along }
        : {
              top: H / 2 - thick / 2 + S * 0.04,
              left: pad,
              width: along,
              height: thick,
          }
    const thumbLong = S * 0.42
    const thumbShort = S * 0.22
    const thumbBox = vertical
        ? {
              left: W / 2 - thumbLong / 2,
              top: lead + thumbFromUp - thumbShort / 2,
              width: thumbLong,
              height: thumbShort,
          }
        : {
              left: pad + along - thumbFromUp - thumbShort / 2,
              top: H / 2 + S * 0.04 - thumbLong / 2,
              width: thumbShort,
              height: thumbLong,
          }
    // A level fills from the low end to the thumb.
    const fill: CSSProperties = vertical
        ? {
              left: groove.left,
              width: thick,
              top: lead + thumbFromUp,
              height: along - thumbFromUp,
          }
        : {
              top: groove.top,
              height: thick,
              left: pad,
              width: along - thumbFromUp,
          }

    const grooveDark = `color-mix(in oklab, ${F.face} 55%, #000)`
    const thumbTop = `color-mix(in oklab, ${F.faceTop} 70%, #fff)`
    const thumbBot = `color-mix(in oklab, ${F.face} 85%, #000)`

    const end = (
        side: KnobSide | undefined,
        at: 'up' | 'down',
    ): JSX.Element => {
        const pos: CSSProperties = vertical
            ? at === 'up'
                ? { top: S * 0.24, left: 0, right: 0 }
                : { bottom: S * 0.06, left: 0, right: 0 }
            : at === 'up'
              ? { right: S * 0.06, bottom: S * 0.08 }
              : { left: S * 0.06, bottom: S * 0.08 }
        return (
            <span
                className="font-keycap"
                title={side?.title ?? side?.text}
                style={{
                    position: 'absolute',
                    ...pos,
                    display: 'flex',
                    justifyContent: 'center',
                    gap: 2,
                    fontSize: valSize,
                    fontWeight: 700,
                    lineHeight: 1,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    color: side?.text ? ink : 'var(--muted-foreground)',
                    opacity: selected && selectedDir !== at ? 0.45 : 1,
                }}
            >
                {side?.parts ? (
                    <LegendParts parts={side.parts} title={side.title} />
                ) : (
                    side?.text || '—'
                )}
            </span>
        )
    }

    return (
        <div style={{ position: 'relative', width: W, height: H }}>
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
            <div
                aria-hidden
                style={{
                    position: 'absolute',
                    inset: 0,
                    pointerEvents: 'none',
                }}
            >
                {/* the half being edited */}
                {selectedDir && (
                    <div
                        style={{
                            position: 'absolute',
                            borderRadius: S * 0.1,
                            background:
                                'color-mix(in oklab, var(--primary) 20%, transparent)',
                            ...(vertical
                                ? {
                                      left: 3,
                                      right: 3,
                                      ...(selectedDir === 'up'
                                          ? { top: 3, height: H / 2 - 3 }
                                          : { top: H / 2, height: H / 2 - 6 }),
                                  }
                                : {
                                      top: 3,
                                      bottom: 6,
                                      ...(selectedDir === 'up'
                                          ? { left: W / 2, width: W / 2 - 3 }
                                          : { left: 3, width: W / 2 - 3 }),
                                  }),
                        }}
                    />
                )}
                {!headerHidden && (
                    <span
                        className="font-keycap"
                        style={{
                            position: 'absolute',
                            top: S * 0.08,
                            left: S * 0.1,
                            fontSize: headerSize,
                            fontWeight: 700,
                            letterSpacing: '.02em',
                            lineHeight: 1,
                            whiteSpace: 'nowrap',
                            color: `color-mix(in oklab, ${ink} 70%, transparent)`,
                        }}
                    >
                        {legend.title}
                    </span>
                )}
                {legend.motor && legend.motor !== 'off' && (
                    <span
                        title="Motorized"
                        style={{
                            position: 'absolute',
                            top: S * 0.06,
                            right: S * 0.07,
                            color: ink,
                            opacity: 0.85,
                        }}
                    >
                        <Cog size={Math.max(9, S * 0.16)} />
                    </span>
                )}
                <span
                    style={{
                        position: 'absolute',
                        ...groove,
                        borderRadius: 99,
                        background: `linear-gradient(90deg, ${grooveDark}, color-mix(in oklab, ${F.face} 75%, #000))`,
                        boxShadow: 'inset 0 1px 3px rgba(0,0,0,.6)',
                    }}
                />
                {legend.kind === 'level' && (
                    <span
                        style={{
                            position: 'absolute',
                            ...fill,
                            borderRadius: 99,
                            background: edge,
                            opacity: 0.85,
                        }}
                    />
                )}
                <span
                    style={{
                        position: 'absolute',
                        ...thumbBox,
                        borderRadius: S * 0.07,
                        background: `linear-gradient(180deg, ${thumbTop}, ${thumbBot})`,
                        boxShadow: `0 2px 4px rgba(0,0,0,.55), 0 0 0 1px ${thumbBot}${
                            legend.motor && legend.motor !== 'off'
                                ? `, 0 0 0 ${Math.max(2, S * 0.04)}px color-mix(in oklab, ${edge} 55%, transparent)`
                                : ''
                        }`,
                    }}
                />
                {legend.kind === 'keys' && (
                    <>
                        {end(legend.up, 'up')}
                        {end(legend.down, 'down')}
                    </>
                )}
                {legend.kind === 'level' && legend.range && (
                    <span
                        className="font-keycap"
                        style={{
                            position: 'absolute',
                            ...(vertical
                                ? {
                                      bottom: S * 0.06,
                                      left: 0,
                                      right: 0,
                                      textAlign: 'center',
                                  }
                                : { right: S * 0.08, bottom: S * 0.08 }),
                            fontSize: valSize * 0.85,
                            fontWeight: 700,
                            lineHeight: 1,
                            color: ink,
                        }}
                    >
                        {legend.range}
                    </span>
                )}
            </div>
            {/* Hit zones — the board's delegated click reads data-idx + data-slider-dir. */}
            {SLIDER_DIRS.map(({ dir, long }) => (
                <div
                    key={dir}
                    role="button"
                    tabIndex={0}
                    data-key="true"
                    data-idx={idx}
                    data-slider-dir={dir}
                    aria-label={`${legend.title} ${long.toLowerCase()}`}
                    style={{
                        position: 'absolute',
                        cursor: 'pointer',
                        ...(vertical
                            ? {
                                  left: 0,
                                  right: 0,
                                  ...(dir === 'up'
                                      ? { top: 0, height: '50%' }
                                      : { bottom: 0, height: '50%' }),
                              }
                            : {
                                  top: 0,
                                  bottom: 0,
                                  ...(dir === 'up'
                                      ? { right: 0, width: '50%' }
                                      : { left: 0, width: '50%' }),
                              }),
                    }}
                />
            ))}
        </div>
    )
}

export const SliderCap = memo(SliderCapImpl)
