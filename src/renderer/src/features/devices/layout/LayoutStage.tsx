// Pattern check: no GoF pattern (-) — rejected — layout-mode canvas: the device stage's shell + controls with drag-to-move on a ¼U grid; geometry stays in stage/geometry.ts.
//
// The Builder's device canvas. Controls are dragged on a quarter-unit grid
// (hold Alt for free placement) and the body refits around them; the canvas
// frame stays put while a drag is in progress so the device does not jump
// under the pointer.
import {
    useCallback,
    useEffect,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
    type JSX,
    type PointerEvent as ReactPointerEvent,
} from 'react'
import type { DeviceControl, DeviceModel } from '@firmware/devices/types'
import { inVariant, variantControls } from '@firmware/devices/variants'
import type { BindingSummary } from '@/lib/devices/bindingSummary'
import { snapU } from '@/lib/devices/layoutOps'
import { ControlShape, type ControlBox } from '../stage/ControlShape'
import {
    computeLayout,
    DEV_S,
    type StageFrame,
    type StageLayout,
} from '../stage/geometry'
import { ShellView } from '../stage/ShellView'
import { useBoxSize } from '../stage/useBoxSize'

interface Drag {
    id: string
    sx: number
    sy: number
    x0: number
    y0: number
    moved: boolean
    frame: StageFrame
}

export interface LayoutStageProps {
    model: DeviceModel
    selected: string | null
    onSelect: (id: string | null) => void
    /** A drag moved past its threshold: the edit is about to start. */
    onDragStart: () => void
    /** Control `id` dragged to (x, y) key units, already snapped. */
    onMove: (id: string, x: number, y: number) => void
    onDragEnd: () => void
    className?: string
    /** Pan/zoom over the fitted layout (zoom 1 = fit; pan in viewport px),
     *  the builder's view model. Wheel zooms about the cursor, middle-drag or
     *  Space-drag pans. Omitted: always fitted. */
    view?: StageView
    onView?: (view: StageView) => void
    /** Move freely instead of on the quarter-unit grid (⌥ also frees a drag). */
    free?: boolean
    /** The layout variant on show ("" = all): the body fits its controls and
     *  the other variants' controls are dimmed. */
    variant?: string
}

export interface StageView {
    zoom: number
    panX: number
    panY: number
}

const FIT: StageView = { zoom: 1, panX: 0, panY: 0 }
const Z_MIN = 0.25
const Z_MAX = 4
const clampZoom = (z: number): number => Math.min(Z_MAX, Math.max(Z_MIN, z))

const NEUTRAL: BindingSummary = { text: '', cat: 'none' }
const NOOP_HOVER = (): void => {}

function boxOf(c: DeviceControl, L: StageLayout): ControlBox {
    return {
        x: L.ox + c.x * DEV_S,
        y: L.oy + c.y * DEV_S,
        w: c.w * DEV_S,
        h: c.h * DEV_S,
    }
}

function CoordBadge({
    c,
    box,
}: {
    c: DeviceControl
    box: ControlBox
}): JSX.Element {
    return (
        <div
            className="pointer-events-none absolute z-[6] -translate-x-1/2 rounded-md bg-primary px-2 py-1 font-mono text-caption font-semibold whitespace-nowrap text-primary-foreground"
            style={{ left: box.x + box.w / 2, top: box.y + box.h + 10 }}
        >
            {c.x.toFixed(2)}, {c.y.toFixed(2)} · {c.w}×{c.h}U
            {c.r ? ` · ${c.r}°` : ''}
        </div>
    )
}

function HoverTag({
    c,
    box,
}: {
    c: DeviceControl
    box: ControlBox
}): JSX.Element {
    return (
        <div
            className="pointer-events-none absolute z-[5] -translate-x-1/2 -translate-y-full rounded-md border border-border bg-popover px-[11px] py-[7px] whitespace-nowrap shadow-[0_10px_28px_rgba(0,0,0,.4)]"
            style={{ left: box.x + box.w / 2, top: box.y - 10 }}
        >
            <div className="eyebrow">{c.name}</div>
            <div className="text-panel-title font-bold">
                {c.shape} · {c.zone ?? 'body'}
            </div>
        </div>
    )
}

export function LayoutStage({
    model,
    selected,
    onSelect,
    onDragStart,
    onMove,
    onDragEnd,
    className,
    view = FIT,
    onView,
    free = false,
    variant = '',
}: LayoutStageProps): JSX.Element {
    const wrapRef = useRef<HTMLDivElement>(null)
    const size = useBoxSize(wrapRef)
    const [drag, setDrag] = useState<Drag | null>(null)
    const [hover, setHover] = useState<string | null>(null)
    const L = useMemo(() => {
        const shown = variantControls(model, variant)
        // A variant with every control tagged elsewhere still gets a body.
        const fitted = shown.length ? { ...model, controls: shown } : model
        return computeLayout(fitted, { compact: true, frozen: drag?.frame })
    }, [model, variant, drag?.frame])
    const fit = Math.max(0.3, Math.min(size.w / L.W, size.h / L.H, 1.35) * 0.96)
    const scale = fit * view.zoom
    const spacePan = useSpaceHeld(!!onView)
    const viewRef = useRef(view)
    useLayoutEffect(() => {
        viewRef.current = view
    })

    // Wheel zoom about the cursor (non-passive so the page does not scroll).
    useEffect(() => {
        const el = wrapRef.current
        if (!el || !onView) return
        const onWheel = (e: WheelEvent): void => {
            e.preventDefault()
            const v = viewRef.current
            const rect = el.getBoundingClientRect()
            const cx = e.clientX - rect.left - rect.width / 2
            const cy = e.clientY - rect.top - rect.height / 2
            const nz = clampZoom(v.zoom * (e.deltaY < 0 ? 1.12 : 1 / 1.12))
            if (nz === v.zoom) return
            const k = nz / v.zoom
            onView({
                zoom: nz,
                panX: cx - (cx - v.panX) * k,
                panY: cy - (cy - v.panY) * k,
            })
        }
        el.addEventListener('wheel', onWheel, { passive: false })
        return () => el.removeEventListener('wheel', onWheel)
    }, [onView])

    const startPan = (e: ReactPointerEvent): void => {
        if (!onView) return
        e.preventDefault()
        const sx = e.clientX
        const sy = e.clientY
        const v0 = viewRef.current
        const move = (ev: PointerEvent): void =>
            onView({
                ...v0,
                panX: v0.panX + ev.clientX - sx,
                panY: v0.panY + ev.clientY - sy,
            })
        const up = (): void => {
            window.removeEventListener('pointermove', move)
            window.removeEventListener('pointerup', up)
        }
        window.addEventListener('pointermove', move)
        window.addEventListener('pointerup', up)
    }
    // Latest callbacks for the window listeners of an ongoing drag.
    const cb = useRef({ onDragStart, onMove, onDragEnd })
    useLayoutEffect(() => {
        cb.current = { onDragStart, onMove, onDragEnd }
    })

    useEffect(() => {
        if (!drag) return
        const move = (e: PointerEvent): void => {
            if (
                !drag.moved &&
                Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) < 3
            )
                return
            if (!drag.moved) {
                drag.moved = true
                cb.current.onDragStart()
            }
            const k = DEV_S * scale
            cb.current.onMove(
                drag.id,
                snapU(drag.x0 + (e.clientX - drag.sx) / k, free || e.altKey),
                snapU(drag.y0 + (e.clientY - drag.sy) / k, free || e.altKey),
            )
        }
        const up = (): void => {
            if (drag.moved) cb.current.onDragEnd()
            setDrag(null)
        }
        window.addEventListener('pointermove', move)
        window.addEventListener('pointerup', up)
        return () => {
            window.removeEventListener('pointermove', move)
            window.removeEventListener('pointerup', up)
        }
    }, [drag, scale, free])

    const onPress = useCallback(
        (id: string, e: ReactPointerEvent) => {
            onSelect(id)
            const c = model.controls.find((k) => k.id === id)
            if (!c) return
            setDrag({
                id,
                sx: e.clientX,
                sy: e.clientY,
                x0: c.x,
                y0: c.y,
                moved: false,
                frame: { W: L.W, H: L.H, ox: L.ox, oy: L.oy },
            })
        },
        [model, onSelect, L],
    )

    const sel = model.controls.find((c) => c.id === selected)
    const hov =
        !drag && hover ? model.controls.find((c) => c.id === hover) : undefined

    return (
        <div
            ref={wrapRef}
            onPointerDown={(e) => {
                if (spacePan || e.button === 1) return startPan(e)
                onSelect(null)
            }}
            className={
                className ?? 'absolute inset-[56px_0_56px] overflow-hidden'
            }
            style={spacePan ? { cursor: 'grab' } : undefined}
        >
            <div
                className="absolute top-1/2 left-1/2"
                style={{
                    width: L.W,
                    height: L.H,
                    transform: `translate(calc(-50% + ${view.panX}px), calc(-50% + ${view.panY}px)) scale(${scale})`,
                }}
            >
                <div className="relative" style={{ width: L.W, height: L.H }}>
                    <div
                        className="absolute inset-0 rounded-xl opacity-60"
                        style={{
                            backgroundImage:
                                'radial-gradient(color-mix(in oklab, var(--foreground) 22%, transparent) 1.2px, transparent 1.2px)',
                            backgroundSize: `${DEV_S}px ${DEV_S}px`,
                            backgroundPosition: `${(L.ox % DEV_S) - DEV_S / 2}px ${(L.oy % DEV_S) - DEV_S / 2}px`,
                        }}
                    />
                    <div
                        title="Origin (0, 0)"
                        className="absolute size-2.5 border-t-2 border-l-2 border-primary opacity-80"
                        style={{ left: L.ox - 5, top: L.oy - 5 }}
                    />
                    <ShellView parts={L.shell} ox={L.ox} oy={L.oy} outline />
                    {model.controls.map((c) => (
                        <div
                            key={c.id}
                            className={
                                inVariant(c, variant) ? undefined : 'opacity-30'
                            }
                        >
                            <ControlShape
                                control={c}
                                box={boxOf(c, L)}
                                summary={NEUTRAL}
                                selected={selected === c.id}
                                hovered={hover === c.id}
                                mono
                                live={false}
                                preview
                                onPress={onPress}
                                onSelect={onSelect}
                                onHover={drag ? NOOP_HOVER : setHover}
                            />
                        </div>
                    ))}
                    {sel ? <CoordBadge c={sel} box={boxOf(sel, L)} /> : null}
                    {hov ? <HoverTag c={hov} box={boxOf(hov, L)} /> : null}
                </div>
            </div>
        </div>
    )
}

/** True while Space is held outside a text field (temporary pan mode). */
function useSpaceHeld(enabled: boolean): boolean {
    const [held, setHeld] = useState(false)
    useEffect(() => {
        if (!enabled) return
        const typing = (t: EventTarget | null): boolean =>
            t instanceof HTMLElement &&
            (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))
        const dn = (e: KeyboardEvent): void => {
            if (e.code !== 'Space' || typing(e.target)) return
            e.preventDefault()
            setHeld(true)
        }
        const up = (e: KeyboardEvent): void => {
            if (e.code === 'Space') setHeld(false)
        }
        window.addEventListener('keydown', dn)
        window.addEventListener('keyup', up)
        return () => {
            window.removeEventListener('keydown', dn)
            window.removeEventListener('keyup', up)
        }
    }, [enabled])
    return held
}
