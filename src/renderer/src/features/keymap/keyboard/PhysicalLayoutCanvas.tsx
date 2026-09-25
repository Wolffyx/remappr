import React, {
    memo,
    PropsWithChildren,
    useCallback,
    useEffect,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
} from 'react'
import { Maximize2, Minus, Plus } from 'lucide-react'
import { HoldTapLabels, KeyButtonView } from './KeyButton.tsx'
import { EncoderCap } from './EncoderCap'
import type { KnobLegend } from '@/features/encoders/knobLegend'
import {
    type EncoderSelection,
    parseEncoderHitId,
} from '@/features/encoders/model'
import { clamp } from '@/lib/clampInt'
import { scalePosition } from '@/lib/scalePosition'
import { LayoutZoom } from '@/lib/helpers'
import type { ColorMode, KeyCategory } from '@/lib/keymap/keyCategory'
import useUserSettingsStore, { type CapStyle } from '@/stores/userSettingsStore'
import useConnectionStore from '@/stores/connectionStore'
import type { HsvColor } from '@firmware/service'
import type { KeyLightInput, UnifiedLighting } from '@/features/lighting/engine'

// Enabled solid cfg used to render per-key colours when no global effect is active
// (e.g. paint mode with the device effect off) — the per-key colour overrides hue.
const SOLID_BASE: UnifiedLighting = {
    enabled: true,
    effect: 'solid',
    hue: 286,
    rainbow: false,
    sat: 0.9,
    brightness: 0.85,
    speed: 0.5,
    underglow: true,
    backlight: true,
    perKey: true,
}

export type KeyPosition = PropsWithChildren<{
    id?: string
    header?: string
    tapText?: string
    /** Full value for the hover tooltip when tapText is an abbreviated glyph. */
    valueTitle?: string
    actionLabel?: string
    holdTap?: HoldTapLabels
    /** Chord modifier names (e.g. ["Ctrl","Shift"]) → chips above the legend. */
    mods?: string[]
    category?: KeyCategory
    accentCategory?: KeyCategory
    heat?: number | null
    /** Raw lifetime press count, shown in the rich tooltip when the heatmap is on. */
    pressCount?: number | null
    width: number
    height: number
    x: number
    y: number
    r?: number
    rx?: number
    ry?: number
    // A knob, not a key: skipped by key-only paths (nav, heatmap, paint), and
    // carries the legend its cap shows per turn direction.
    knob?: KnobLegend
}>

// Pattern check: no GoF pattern (-) — rejected — plain prop/callback shape additions for
// multi-select highlight + click modifiers; data plumbing, no abstraction or polymorphism.
/** Modifier keys held during a key click, used to drive multi-select. */
export interface ClickModifiers {
    shiftKey: boolean
    metaKey: boolean
    ctrlKey: boolean
}

interface PhysicalLayoutCanvasProps {
    positions: Array<KeyPosition>
    selectedPosition?: number
    // Additional positions highlighted as part of a multi-selection.
    selectedPositions?: Set<number>
    selectedEncoder?: EncoderSelection
    oneU?: number
    hoverZoom?: boolean
    // Presentational forwards for small/clean previews (e.g. start-page device card).
    capStyleOverride?: CapStyle
    colorModeOverride?: ColorMode
    showHeaderTag?: boolean
    showCategoryDot?: boolean
    zoom?: LayoutZoom
    // Opt-in wheel-zoom + drag-pan stage with a zoom HUD. Off by default so the
    // small layout-picker preview keeps its plain auto-fit behaviour.
    pannable?: boolean
    // Opt-in rich hover tooltips on each key (tap/action/hold/type/press-count).
    tooltips?: boolean
    // RGB-simulation config; when enabled, each key renders an underglow layer.
    lighting?: UnifiedLighting | null
    // Per-key colours (device HSV 0–255) indexed by key position; drives the glow
    // and shows the keyboard's / painted per-key colours.
    perKeyColors?: Array<HsvColor | null> | null
    // Paint mode: clicks paint the key instead of selecting; right-click eyedrops.
    paintMode?: boolean
    onKeyPaint?: (position: number) => void
    onKeyEyedrop?: (position: number) => void
    // Paint gesture ended (pointerup) → flush coalesced writes to the device.
    onPaintCommit?: () => void
    onPositionClicked?: (position: number, mods?: ClickModifiers) => void
    onEncoderClicked?: (sel: EncoderSelection) => void
    // Right-click on a key (not encoder) → host shows a context menu at the
    // viewport coords. Skipped silently when undefined so callers that
    // don't want the menu don't pay for the wiring.
    onPositionContextMenu?: (
        position: number,
        coords: { x: number; y: number },
    ) => void
    pressedKeys?: ReadonlySet<number>
    /** Key Test: positions seen pressed at least once this sweep — rendered with a
     *  persistent "tested" ring, distinct from the transient pressed flash. */
    seenKeys?: ReadonlySet<number>
}

// pattern-check: skip — shared frozen empty Set for stable prop defaults, no abstraction
// Stable default for `pressedKeys`/`seenKeys` so an omitted prop doesn't create a fresh
// Set every render and break the `keysPositions` memo. Only ever read (`.has`), never
// mutated, so a single shared instance is safe.
const EMPTY_SET: ReadonlySet<number> = new Set<number>()

const MIN_ZOOM = 0.4
const MAX_ZOOM = 3.2

// Auto-fit sizes the key unit (oneU) itself — the design prototype's model —
// instead of transform-scaling a fixed-oneU board. Rendering caps at their real
// size keeps the 1px borders and px-fixed shadows crisp (a transform scale would
// magnify them). The relative zoom is then a plain transform on top.
const MIN_ONE_U = 34
const MAX_ONE_U = 92
const FIT_PADDING = 48

// pattern-check: skip — rename View.scale→zoom + relative-zoom semantics, no new abstraction
// User-adjusted view; null = follow auto-fit (zoom 1, no pan). `zoom` is the
// factor *relative to the auto-fit scale* — exactly the design prototype's
// model, where 1.0 = "fitted to the viewport" and the [0.4, 3.2] range is the
// same no matter how big the board or viewport is. `tx`/`ty` are the pan
// offset in viewport px (applied before the scale, like the prototype).
interface View {
    zoom: number
    tx: number
    ty: number
}

const PhysicalLayoutCanvasImpl = ({
    positions,
    selectedPosition,
    selectedPositions,
    selectedEncoder,
    oneU = 48,
    hoverZoom = true,
    capStyleOverride,
    colorModeOverride,
    showHeaderTag,
    showCategoryDot,
    pannable = false,
    tooltips = false,
    lighting = null,
    perKeyColors = null,
    paintMode = false,
    onKeyPaint,
    onKeyEyedrop,
    onPaintCommit,
    onPositionClicked,
    onEncoderClicked,
    onPositionContextMenu,
    pressedKeys = EMPTY_SET,
    seenKeys = EMPTY_SET,
    ...props
}: PhysicalLayoutCanvasProps): JSX.Element => {
    const ref = useRef<HTMLDivElement>(null)
    const viewportRef = useRef<HTMLDivElement>(null)
    const [scale, setScale] = useState(1)
    // Fitted key-unit size for the pannable stage (design model). Non-pannable
    // previews keep the fixed `oneU` prop and fit via the transform `scale`.
    const [fitU, setFitU] = useState(oneU)
    const [view, setView] = useState<View | null>(null)
    // True while actively panning — disables the transform transition so the
    // board tracks the pointer 1:1 instead of easing behind it.
    const [dragging, setDragging] = useState(false)

    const { zoom } = props

    // Resolve the cap-style / colour-mode / firmware display-mode ONCE for the whole
    // board (honouring per-call overrides) and pass them down as props, so the N keys
    // don't each subscribe to the connection + user-settings stores.
    const capStyleSetting = useUserSettingsStore((s) => s.capStyle)
    const colorModeSetting = useUserSettingsStore((s) => s.colorMode)
    const keyDisplayModeMap = useUserSettingsStore((s) => s.keyDisplayMode)
    const firmware = useConnectionStore((s) => s.service?.deviceInfo.firmware)
    const capStyle = capStyleOverride ?? capStyleSetting
    const colorMode = colorModeOverride ?? colorModeSetting
    const keyDisplayMode =
        keyDisplayModeMap[firmware ?? '_default'] ??
        keyDisplayModeMap['_default'] ??
        'displayName'

    // TODO: Add a bit of padding for rotation when supported
    // Board bounds depend only on `positions`; memoized so the reduce doesn't run on
    // every render (selection/pan/paint re-renders don't touch the geometry).
    const { rightMost, bottomMost } = useMemo(
        () =>
            positions.reduce(
                (
                    acc: { rightMost: number; bottomMost: number },
                    {
                        x,
                        y,
                        width,
                        height,
                    }: {
                        x: number
                        y: number
                        width: number
                        height: number
                    },
                ): { rightMost: number; bottomMost: number } => ({
                    rightMost: Math.max(acc.rightMost, x + width),
                    bottomMost: Math.max(acc.bottomMost, y + height),
                }),
                { rightMost: 0, bottomMost: 0 },
            ),
        [positions],
    )

    // pattern-check: skip — debounce wrapper around the existing refit callbacks
    // Refits re-render the whole board (every cap + glow layer re-rasterizes),
    // so a continuous resize — the sidebar's 200ms width transition, dragging
    // the window edge — must NOT refit per ResizeObserver frame. First fit is
    // immediate; bursts settle with one trailing refit once the size is stable.
    const REFIT_SETTLE_MS = 120

    useLayoutEffect((): (() => void) | void => {
        // Pannable stage: fit by sizing oneU (caps render at real size → crisp).
        if (pannable) {
            const vp = viewportRef.current
            if (!vp || rightMost === 0 || bottomMost === 0) return
            const fit = (): void => {
                const u = Math.min(
                    (vp.clientWidth - FIT_PADDING * 2) / rightMost,
                    (vp.clientHeight - FIT_PADDING * 2) / bottomMost,
                )
                if (Number.isFinite(u)) {
                    setFitU(clamp(u, MIN_ONE_U, MAX_ONE_U))
                }
            }
            fit()
            let settle: number | undefined
            const ro = new ResizeObserver((): void => {
                window.clearTimeout(settle)
                settle = window.setTimeout(fit, REFIT_SETTLE_MS)
            })
            ro.observe(vp)
            return (): void => {
                window.clearTimeout(settle)
                ro.disconnect()
            }
        }

        // Non-pannable preview: keep the fixed oneU and fit via transform scale.
        const element = ref.current
        if (!element) return
        const parent = element.parentElement
        if (!parent) return
        const calculateScale = (): void => {
            if (zoom === 'auto') {
                const padding =
                    Math.min(window.innerWidth, window.innerHeight) * 0.05
                setScale(
                    Math.min(
                        parent.clientWidth /
                            (element.clientWidth + padding * 2),
                        parent.clientHeight /
                            (element.clientHeight + padding * 2),
                    ),
                )
            } else {
                setScale(zoom || 1)
            }
        }
        calculateScale()
        let settle: number | undefined
        const resizeObserver = new ResizeObserver((): void => {
            window.clearTimeout(settle)
            settle = window.setTimeout(calculateScale, REFIT_SETTLE_MS)
        })
        resizeObserver.observe(element)
        resizeObserver.observe(parent)
        return (): void => {
            window.clearTimeout(settle)
            resizeObserver.disconnect()
        }
    }, [zoom, pannable, rightMost, bottomMost])

    // Pannable caps render at the fitted oneU; previews use the fixed prop.
    const effOneU = pannable ? fitU : oneU
    // Board pixel dims depend only on the bounds + fitted unit; memoized to keep the
    // value referentially stable across unrelated re-renders (clampPan/applyTransform
    // deps stay quiet when geometry is unchanged).
    const { boardW, boardH } = useMemo(
        () => ({ boardW: rightMost * effOneU, boardH: bottomMost * effOneU }),
        [rightMost, bottomMost, effOneU],
    )

    // For the pannable stage the board is already at its fitted size, so the
    // transform is just the relative zoom (1 = fitted, crisp). Previews still
    // fold the auto-fit `scale` into the transform.
    const zoomLevel = view ? view.zoom : 1
    const effScale = pannable ? zoomLevel : scale * zoomLevel
    const tx = view ? view.tx : 0
    const ty = view ? view.ty : 0

    // pattern-check: skip — imperative transform plumbing during gestures, no abstraction
    // Pan/zoom is applied DIRECTLY to the board's `style.transform` during a gesture
    // (rAF-batched) and only committed to React state on gesture end, so dragging the
    // empty stage doesn't re-render the whole key list every pointer frame. `viewRef`
    // mirrors `view` synchronously for the imperative path; the layout effect keeps the
    // DOM transform in sync with committed state (double-click reset, zoom buttons,
    // ResizeObserver scale changes). It writes ONLY `transform` — no will-change /
    // translateZ — so the crispness contract holds.
    const viewRef = useRef<View | null>(view)
    const rafId = useRef<number | null>(null)
    const pendingView = useRef<View | null>(null)
    const applyTransform = useCallback(
        (v: View | null): void => {
            const board = ref.current
            if (!board) return
            const zl = v ? v.zoom : 1
            const eff = pannable ? zl : scale * zl
            const px = v ? v.tx : 0
            const py = v ? v.ty : 0
            board.style.transform = `translate(${px}px, ${py}px) scale(${eff})`
        },
        [pannable, scale],
    )
    const flushTransform = useCallback((): void => {
        rafId.current = null
        if (pendingView.current) applyTransform(pendingView.current)
    }, [applyTransform])
    useLayoutEffect((): void => {
        viewRef.current = view
        applyTransform(view)
    }, [view, applyTransform])

    // Pan clamp, ported from the design prototype: keep at least half the board
    // (or the whole viewport, whichever is larger) within reach. `z` is the
    // relative zoom; boardW/boardH are already at the fitted oneU.
    const clampPan = useCallback(
        (nx: number, ny: number, z: number): { tx: number; ty: number } => {
            const vp = viewportRef.current
            if (!vp) return { tx: nx, ty: ny }
            const cw = boardW * z
            const ch = boardH * z
            const limX = Math.max(cw, vp.clientWidth) / 2
            const limY = Math.max(ch, vp.clientHeight) / 2
            return { tx: clamp(nx, -limX, limX), ty: clamp(ny, -limY, limY) }
        },
        [boardW, boardH],
    )

    // Wheel-zoom centred on the cursor. Native (non-passive) listener so we can
    // preventDefault. Reads live state from `viewRef` (not `view`) and applies the
    // transform imperatively, committing to React state on a trailing debounce — so the
    // listener registers once (no `view` in deps) and a wheel gesture doesn't re-render
    // the key list per notch.
    useEffect((): (() => void) | void => {
        if (!pannable) return
        const vp = viewportRef.current
        if (!vp) return
        let commitTimer: number | undefined
        const onWheel = (e: WheelEvent): void => {
            e.preventDefault()
            const rect = vp.getBoundingClientRect()
            const cur = viewRef.current
            const curZoom = cur ? cur.zoom : 1
            const curTx = cur ? cur.tx : 0
            const curTy = cur ? cur.ty : 0
            // Fixed multiplicative step per notch (design prototype), so the feel
            // is identical on a mouse wheel and a trackpad regardless of deltaY.
            const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12
            const nz = clamp(curZoom * factor, MIN_ZOOM, MAX_ZOOM)
            if (nz === curZoom) return
            const cx = e.clientX - rect.left - rect.width / 2
            const cy = e.clientY - rect.top - rect.height / 2
            // Keep the board point under the cursor fixed: k is the zoom ratio.
            const k = nz / curZoom
            const next = clampPan(
                cx - (cx - curTx) * k,
                cy - (cy - curTy) * k,
                nz,
            )
            const v = { zoom: nz, ...next }
            viewRef.current = v
            applyTransform(v)
            window.clearTimeout(commitTimer)
            commitTimer = window.setTimeout(() => {
                if (viewRef.current) setView(viewRef.current)
            }, 140)
        }
        vp.addEventListener('wheel', onWheel, { passive: false })
        return (): void => {
            vp.removeEventListener('wheel', onWheel)
            window.clearTimeout(commitTimer)
        }
    }, [pannable, clampPan, applyTransform])

    // Drag-to-pan on empty stage space. A drag that starts on a key is left alone so
    // the key still selects on click.
    const drag = useRef<{
        active: boolean
        startX: number
        startY: number
        baseTx: number
        baseTy: number
        zoom: number
        pointerId: number
    } | null>(null)

    // pattern-check: skip — imperative drag-pan handlers, no abstraction
    const onPointerDown = useCallback((e: React.PointerEvent): void => {
        const target = e.target as HTMLElement
        if (
            target.closest('[data-key="true"]') ||
            target.closest('[data-zoomhud="true"]')
        ) {
            return
        }
        const cur = viewRef.current
        drag.current = {
            active: true,
            startX: e.clientX,
            startY: e.clientY,
            baseTx: cur ? cur.tx : 0,
            baseTy: cur ? cur.ty : 0,
            zoom: cur ? cur.zoom : 1,
            pointerId: e.pointerId,
        }
        setDragging(true)
        viewportRef.current?.setPointerCapture(e.pointerId)
    }, [])

    const onPointerMove = useCallback(
        (e: React.PointerEvent): void => {
            const d = drag.current
            if (!d?.active) return
            const next = clampPan(
                d.baseTx + (e.clientX - d.startX),
                d.baseTy + (e.clientY - d.startY),
                d.zoom,
            )
            // Imperative + rAF-batched: write the DOM transform now, commit to state
            // on pointer-up — no re-render per move.
            const v = { zoom: d.zoom, ...next }
            viewRef.current = v
            pendingView.current = v
            if (rafId.current == null)
                rafId.current = requestAnimationFrame(flushTransform)
        },
        [clampPan, flushTransform],
    )

    const onPointerUp = useCallback((e: React.PointerEvent): void => {
        if (drag.current?.active) {
            viewportRef.current?.releasePointerCapture(drag.current.pointerId)
            drag.current.active = false
            if (rafId.current != null) {
                cancelAnimationFrame(rafId.current)
                rafId.current = null
            }
            // Commit the final view once so React state matches the DOM + the HUD %.
            if (viewRef.current) setView(viewRef.current)
        }
        setDragging(false)
        void e
    }, [])

    const onDoubleClick = useCallback((e: React.MouseEvent): void => {
        const target = e.target as HTMLElement
        if (target.closest('[data-key="true"]')) return
        setView(null)
    }, [])

    const zoomBy = useCallback(
        (factor: number): void => {
            const cur = viewRef.current
            const curZoom = cur ? cur.zoom : 1
            const nz = clamp(curZoom * factor, MIN_ZOOM, MAX_ZOOM)
            const k = nz / curZoom
            const next = clampPan(
                (cur ? cur.tx : 0) * k,
                (cur ? cur.ty : 0) * k,
                nz,
            )
            setView({ zoom: nz, ...next })
        },
        [clampPan],
    )

    // pattern-check: skip — event delegation + useMemo split of an existing render loop, no abstraction
    // Click/context-menu/keyboard are delegated to the board container (one listener
    // each, reading `data-idx`/`data-encoder`) instead of N per-key closures — so the
    // memoized key list below doesn't depend on the handler identities and the wrapper
    // divs stay cheap.
    const keyFromEvent = (
        e: React.SyntheticEvent,
    ): {
        idx: number
        encoder?: EncoderSelection
    } | null => {
        const el = (e.target as HTMLElement).closest(
            '[data-key="true"]',
        ) as HTMLElement | null
        if (!el) return null
        const idx = Number(el.dataset.idx)
        const hitId = el.dataset.encoder
        const encoder = hitId ? parseEncoderHitId(hitId) : null
        return encoder ? { idx, encoder } : { idx }
    }
    // pattern-check: skip — event-delegation paint handlers, plain callbacks, no abstraction
    const handleBoardClick = useCallback(
        (e: React.MouseEvent): void => {
            const hit = keyFromEvent(e)
            if (!hit) return
            if (hit.encoder) {
                onEncoderClicked?.(hit.encoder)
                return
            }
            // Paint mode: pointerdown/over already paints (and commits on
            // pointerup); swallow the click so it doesn't select/edit the key.
            if (paintMode) return
            onPositionClicked?.(hit.idx, {
                shiftKey: e.shiftKey,
                metaKey: e.metaKey,
                ctrlKey: e.ctrlKey,
            })
        },
        [paintMode, onEncoderClicked, onPositionClicked],
    )
    const handleBoardContextMenu = useCallback(
        (e: React.MouseEvent): void => {
            const hit = keyFromEvent(e)
            // Paint mode: right-click eyedrops the key's colour into the brush.
            if (paintMode && hit && !hit.encoder) {
                e.preventDefault()
                onKeyEyedrop?.(hit.idx)
                return
            }
            if (!onPositionContextMenu) return
            if (!hit || hit.encoder) return
            e.preventDefault()
            onPositionContextMenu(hit.idx, { x: e.clientX, y: e.clientY })
        },
        [paintMode, onKeyEyedrop, onPositionContextMenu],
    )

    // Drag-to-paint: hold and sweep across keys. paintingRef tracks the held
    // gesture; pointerover on each key paints it. A window pointerup ends it even
    // if the release lands off the board.
    const paintingRef = useRef(false)
    const handleBoardPointerDown = useCallback(
        (e: React.PointerEvent): void => {
            if (!paintMode) return
            const hit = keyFromEvent(e)
            if (!hit || hit.encoder) return
            paintingRef.current = true
            onKeyPaint?.(hit.idx)
        },
        [paintMode, onKeyPaint],
    )
    const handleBoardPointerOver = useCallback(
        (e: React.PointerEvent): void => {
            if (!paintMode || !paintingRef.current) return
            const hit = keyFromEvent(e)
            if (!hit || hit.encoder) return
            onKeyPaint?.(hit.idx)
        },
        [paintMode, onKeyPaint],
    )
    useEffect((): (() => void) | void => {
        if (!paintMode) return
        const end = (): void => {
            if (!paintingRef.current) return
            paintingRef.current = false
            onPaintCommit?.() // flush the sweep's coalesced writes in one save
        }
        window.addEventListener('pointerup', end)
        return (): void => window.removeEventListener('pointerup', end)
    }, [paintMode, onPaintCommit])
    const handleBoardKeyDown = useCallback(
        (e: React.KeyboardEvent): void => {
            if (e.key !== 'Enter' && e.key !== ' ') return
            const hit = keyFromEvent(e)
            if (!hit) return
            e.preventDefault()
            if (hit.encoder) onEncoderClicked?.(hit.encoder)
            else onPositionClicked?.(hit.idx)
        },
        [onEncoderClicked, onPositionClicked],
    )

    // Underglow inputs: key centre normalized to the board bounds (drives the spatial
    // hue). Encoders skip the glow. Kept in its own memo (NOT keyed on selection) so a
    // selection change reuses the same light-object refs and only the keys whose
    // selected/pressed state actually changed re-render.
    const lightInputs = useMemo((): Array<KeyLightInput | null> | null => {
        if (rightMost <= 0 || bottomMost <= 0) return null
        const anyColor = !!perKeyColors && perKeyColors.some(Boolean)
        if (!lighting?.enabled && !anyColor) return null
        return positions.map((p, idx) => {
            if (p.knob) return null
            const color = perKeyColors?.[idx] ?? undefined
            // No effect glow and no per-key colour → nothing to render for this key.
            if (!lighting?.enabled && !color) return null
            return {
                cfg: lighting?.enabled ? lighting : SOLID_BASE,
                fx: (p.x + p.width / 2) / rightMost,
                fy: (p.y + p.height / 2) / bottomMost,
                idx,
                color,
            }
        })
    }, [positions, lighting, perKeyColors, rightMost, bottomMost])

    const keysPositions = useMemo(
        () =>
            positions.map((p, idx) => {
                const posStyle = scalePosition(p, effOneU)
                if (p.knob) {
                    // A knob: one cap, whose own hit zones carry
                    // data-encoder per turn direction.
                    const selectedDir =
                        selectedEncoder?.slot === p.knob.slot
                            ? selectedEncoder.dir
                            : null
                    return (
                        <div
                            key={p.id}
                            data-idx={idx}
                            className="absolute leading-[0]"
                            style={posStyle as React.CSSProperties}
                        >
                            <EncoderCap
                                knob={p.knob}
                                width={p.width}
                                height={p.height}
                                oneU={effOneU}
                                selectedDir={selectedDir}
                                capStyle={capStyle}
                                colorMode={colorMode}
                                keyDisplayMode={keyDisplayMode}
                                showHeaderTag={showHeaderTag}
                            />
                        </div>
                    )
                }
                return (
                    <div
                        key={p.id}
                        role="button"
                        tabIndex={0}
                        data-key="true"
                        data-idx={idx}
                        className="absolute data-[zoomer=true]:hover:z-[1000] leading-[0]"
                        data-zoomer={hoverZoom}
                        style={posStyle as React.CSSProperties}
                    >
                        <KeyButtonView
                            hoverZoom={hoverZoom}
                            oneU={effOneU}
                            selected={idx === selectedPosition}
                            multiSelected={!!selectedPositions?.has(idx)}
                            pressed={pressedKeys.has(idx)}
                            seen={seenKeys.has(idx)}
                            richTooltip={tooltips}
                            capStyle={capStyle}
                            colorMode={colorMode}
                            keyDisplayMode={keyDisplayMode}
                            showHeaderTag={showHeaderTag}
                            showCategoryDot={showCategoryDot}
                            light={lightInputs?.[idx] ?? null}
                            {...p}
                        />
                    </div>
                )
            }),
        [
            positions,
            effOneU,
            selectedPosition,
            selectedPositions,
            selectedEncoder,
            pressedKeys,
            seenKeys,
            lightInputs,
            hoverZoom,
            tooltips,
            capStyle,
            colorMode,
            keyDisplayMode,
            showHeaderTag,
            showCategoryDot,
        ],
    )

    const board = (
        // Delegation container: click/keydown bubble up from the per-key role="button"
        // tabIndex={0} wrappers, so the board itself needs no interactive role.
        // eslint-disable-next-line jsx-a11y/no-static-element-interactions
        <div
            className="relative"
            style={
                {
                    height: boardH + 'px',
                    width: boardW + 'px',
                    // Plain 2D transform — no translateZ/will-change/backface
                    // hints. Those promote the board to a composited layer with a
                    // fixed-resolution backing store, so zooming in scales a cached
                    // bitmap and the keycaps go blurry. Without them the browser
                    // re-rasterises the vector content crisply at every zoom level.
                    transform: `translate(${tx}px, ${ty}px) scale(${effScale})`,
                    transformOrigin: 'center',
                    transition: dragging ? 'none' : 'transform .08s ease-out',
                } as React.CSSProperties
            }
            ref={ref}
            onClick={handleBoardClick}
            onContextMenu={handleBoardContextMenu}
            onKeyDown={handleBoardKeyDown}
            onPointerDown={paintMode ? handleBoardPointerDown : undefined}
            onPointerOver={paintMode ? handleBoardPointerOver : undefined}
            {...props}
        >
            {keysPositions}
        </div>
    )

    if (!pannable) return <>{board}</>

    // Show zoom relative to fit (100% = fitted), matching the design prototype.
    const livePct = Math.round(zoomLevel * 100)
    return (
        <div
            ref={viewportRef}
            className="absolute inset-0 overflow-hidden flex items-center justify-center touch-none select-none cursor-grab active:cursor-grabbing"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onDoubleClick={onDoubleClick}
        >
            {board}
            <div
                data-zoomhud="true"
                className="absolute top-3 right-3 flex items-center gap-1 rounded-lg border border-border bg-card px-1 py-1 shadow-sm"
            >
                <ZoomButton label="Zoom out" onClick={() => zoomBy(1 / 1.15)}>
                    <Minus className="size-4" />
                </ZoomButton>
                <span className="min-w-12 text-center text-xs font-mono tabular-nums text-muted-foreground">
                    {livePct}%
                </span>
                <ZoomButton label="Zoom in" onClick={() => zoomBy(1.15)}>
                    <Plus className="size-4" />
                </ZoomButton>
                <ZoomButton label="Reset view" onClick={() => setView(null)}>
                    <Maximize2 className="size-4" />
                </ZoomButton>
            </div>
        </div>
    )
}

// pattern-check: skip — memo wrapper around the existing canvas component, no abstraction
export const PhysicalLayoutCanvas = memo(PhysicalLayoutCanvasImpl)

function ZoomButton({
    label,
    onClick,
    children,
}: PropsWithChildren<{ label: string; onClick: () => void }>): JSX.Element {
    return (
        <button
            type="button"
            aria-label={label}
            title={label}
            onClick={onClick}
            className="flex size-7 items-center justify-center rounded-md text-foreground hover:bg-accent transition-colors"
        >
            {children}
        </button>
    )
}
