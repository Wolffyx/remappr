// Pattern check: Dispatch Map (Tier 0) — applied — control shape → renderer table (d-pad and ring draw themselves, every other shape is a face plus a shape-specific inset).
//
// One control drawn on the device stage: its shape, tinted by the category of
// what it is bound to, glowing while held in live view.
import {
    memo,
    type CSSProperties,
    type JSX,
    type PointerEvent as ReactPointerEvent,
} from 'react'
import type {
    ControlShape as Shape,
    DeviceControl,
} from '@firmware/devices/types'
import type { BindingSummary } from '@/lib/devices/bindingSummary'
import { controlColors, type ControlColors } from '@/lib/devices/deviceCategory'
import {
    analogXY,
    useControlAnalog,
    useControlPressed,
} from '../model/liveInputStore'
import { controlRadius } from './geometry'

export interface ControlBox {
    x: number
    y: number
    w: number
    h: number
}

export interface ControlShapeProps {
    control: DeviceControl
    box: ControlBox
    summary: BindingSummary
    selected: boolean
    hovered: boolean
    mono: boolean
    live: boolean
    /** Start-page tile: key caps stay blank. */
    preview?: boolean
    /** Layout mode: a press starts a drag (instead of just selecting). */
    onPress?: (id: string, e: ReactPointerEvent) => void
    onSelect: (id: string) => void
    onHover: (id: string | null) => void
}

interface BodyProps {
    c: DeviceControl
    box: ControlBox
    col: ControlColors
    summary: BindingSummary
    deflect: { x: number; y: number }
    preview: boolean
}

const MONO_FONT = 'font-mono font-bold pointer-events-none'

function Glyph({
    c,
    box,
    col,
}: Pick<BodyProps, 'c' | 'box' | 'col'>): JSX.Element | null {
    if (!c.glyph) return null
    return (
        <span
            className={MONO_FONT}
            style={{
                fontSize: Math.min(box.w, box.h) < 36 ? 10 : 12,
                color: col.ink,
            }}
        >
            {c.glyph}
        </span>
    )
}

function StickThumb({ c, box, col, deflect }: BodyProps): JSX.Element {
    const inset = Math.min(box.w, box.h) * 0.13
    return (
        <div
            className="absolute grid place-items-center rounded-full shadow-[0_4px_10px_rgba(0,0,0,.35)] transition-transform duration-300"
            style={{
                inset,
                background: `radial-gradient(circle at 40% 35%, ${col.top}, ${col.face} 70%)`,
                border: `1px solid ${col.edge}`,
                transform: `translate(${deflect.x * 9}px, ${deflect.y * 9}px)`,
            }}
        >
            <Glyph c={c} box={box} col={col} />
        </div>
    )
}

function KnobCap({ box, col, deflect }: BodyProps): JSX.Element {
    return (
        <div
            className="absolute inset-[10px] rounded-full"
            style={{
                background: `radial-gradient(circle at 40% 35%, ${col.top}, ${col.face})`,
                border: `1px solid ${col.edge}`,
            }}
        >
            <div
                className="absolute top-1 left-1/2 -ml-[1.5px] h-3 w-[3px] rounded-sm transition-transform duration-300"
                style={{
                    background: col.ink,
                    transformOrigin: `50% ${Math.min(box.w, box.h) / 2 - 14}px`,
                    transform: `rotate(${deflect.x * 120}deg)`,
                }}
            />
        </div>
    )
}

const HAT_DIRS = [0, 45, 90, 135, 180, 225, 270, 315] as const

function HatFace({ box, col }: BodyProps): JSX.Element {
    const r = Math.min(box.w, box.h) / 2 - 7
    return (
        <>
            {HAT_DIRS.map((d) => (
                <span
                    key={d}
                    className="absolute top-1/2 left-1/2 -m-[1.5px] size-[3px] rounded-full"
                    style={{
                        background: col.ink,
                        opacity: d % 90 ? 0.35 : 0.8,
                        transform: `rotate(${d}deg) translateY(-${r}px)`,
                    }}
                />
            ))}
            <div
                className="size-3.5 rounded-full"
                style={{ background: col.top, border: `1px solid ${col.edge}` }}
            />
        </>
    )
}

function SensorEye({ col }: BodyProps): JSX.Element {
    return (
        <div
            className="size-3.5 rounded-full opacity-55"
            style={{ background: col.glow, boxShadow: `0 0 14px ${col.glow}` }}
        />
    )
}

function KeyCapFace({ col, summary, preview }: BodyProps): JSX.Element {
    const t = preview ? '' : summary.text
    const size = t.length > 6 ? 8.5 : t.length > 2 ? 10.5 : 15
    return (
        <div
            className="absolute inset-[3px_4px_7px] grid place-items-center rounded-[7px] border border-white/5 p-1 text-center"
            style={{
                background: `linear-gradient(180deg, ${col.top}, ${col.face})`,
            }}
        >
            <span
                className="leading-[1.1] font-bold break-words"
                style={{ fontSize: size, color: col.ink }}
            >
                {t}
            </span>
        </div>
    )
}

/** What sits inside the face, per shape; a shape not listed shows its glyph. */
const INSETS: Partial<Record<Shape, (p: BodyProps) => JSX.Element>> = {
    stick: StickThumb,
    knob: KnobCap,
    hat: HatFace,
    sensor: SensorEye,
    key: KeyCapFace,
}

function faceFill(shape: Shape, box: ControlBox, col: ControlColors): string {
    if (shape === 'wheel') {
        const deg = box.w > box.h ? 90 : 0
        return `repeating-linear-gradient(${deg}deg, ${col.face} 0 4px, ${col.top} 4px 8px)`
    }
    if (shape === 'knob') {
        return `repeating-conic-gradient(${col.face} 0 6deg, ${col.top} 6deg 12deg)`
    }
    return `linear-gradient(180deg, ${col.top}, ${col.face})`
}

const ARROWS = [
    ['▲\uFE0E', { top: 5, left: '50%', marginLeft: -4 }],
    ['▼\uFE0E', { bottom: 5, left: '50%', marginLeft: -4 }],
    ['◀\uFE0E', { left: 5, top: '50%', marginTop: -6 }],
    ['▶\uFE0E', { right: 5, top: '50%', marginTop: -6 }],
] as const

function DpadBody({ box, col }: BodyProps): JSX.Element {
    const arm = Math.min(box.w, box.h) / 3
    const bar = (st: CSSProperties): JSX.Element => (
        <div
            className="absolute rounded-md"
            style={{
                background: `linear-gradient(180deg, ${col.top}, ${col.face})`,
                border: `1px solid ${col.edge}`,
                ...st,
            }}
        />
    )
    return (
        <>
            {bar({
                left: (box.w - arm) / 2,
                top: 0,
                width: arm,
                height: box.h,
            })}
            {bar({
                top: (box.h - arm) / 2,
                left: 0,
                height: arm,
                width: box.w,
            })}
            <div
                className="absolute"
                style={{
                    left: (box.w - arm) / 2 + 1,
                    top: (box.h - arm) / 2 + 1,
                    width: arm - 2,
                    height: arm - 2,
                    background: col.face,
                }}
            />
            {ARROWS.map(([g, pos]) => (
                <span
                    key={g}
                    className="absolute text-[8px] opacity-70"
                    style={{ color: col.ink, ...pos }}
                >
                    {g}
                </span>
            ))}
        </>
    )
}

function RingBody({ c, col, deflect }: BodyProps): JSX.Element {
    return (
        <span
            className="pointer-events-none text-[11px] font-bold tracking-[.04em] transition-transform duration-300"
            style={{
                color: col.ink,
                transform: `translateX(${deflect.x * 10}px)`,
            }}
        >
            {c.kind === 'axis' ? '⟲ ⟳' : '↔ ↕'}
        </span>
    )
}

function surfaceStyle(
    c: DeviceControl,
    box: ControlBox,
    col: ControlColors,
    active: boolean,
): CSSProperties {
    if (c.shape === 'dpad') return {}
    if (c.shape === 'ring') {
        return {
            border: `2px dashed ${col.edge}`,
            background: `color-mix(in oklch, ${col.glow} ${active ? 14 : 6}%, transparent)`,
        }
    }
    const dashed = c.back || c.shape === 'sensor'
    return {
        background: faceFill(c.shape, box, col),
        border: `1px ${dashed ? 'dashed' : 'solid'} ${col.edge}`,
        overflow: 'hidden',
    }
}

function shadowOf(
    col: ControlColors,
    flags: {
        selected: boolean
        hovered: boolean
        pressed: boolean
        flat: boolean
    },
): string {
    const ring = flags.selected
        ? '0 0 0 2px var(--primary), 0 0 22px color-mix(in oklch, var(--primary) 55%, transparent)'
        : flags.hovered
          ? `0 0 0 1.5px ${col.glow}`
          : flags.flat
            ? 'none'
            : 'inset 0 1px 0 color-mix(in oklch, #fff 8%, transparent), 0 2px 4px rgba(0,0,0,.25)'
    return flags.pressed ? `${ring}, 0 0 26px ${col.glow}` : ring
}

function ControlShapeView({
    control: c,
    box,
    summary,
    selected,
    hovered,
    mono,
    live,
    preview = false,
    onPress,
    onSelect,
    onHover,
}: ControlShapeProps): JSX.Element {
    const pressed = useControlPressed(c.id, live)
    const deflect = analogXY(useControlAnalog(c.id, live))
    const col = controlColors(summary.cat, mono)
    const body: BodyProps = { c, box, col, summary, deflect, preview }
    const flat = c.shape === 'dpad' || c.shape === 'ring'
    const Inset =
        c.shape === 'dpad'
            ? DpadBody
            : c.shape === 'ring'
              ? RingBody
              : INSETS[c.shape]
    return (
        <button
            type="button"
            aria-label={`${c.name}: ${summary.text}`}
            aria-pressed={selected}
            onPointerDown={(e) => {
                e.stopPropagation()
                if (onPress) onPress(c.id, e)
                else onSelect(c.id)
            }}
            onPointerEnter={() => onHover(c.id)}
            onPointerLeave={() => onHover(null)}
            className="absolute grid place-items-center p-0 transition-[transform,box-shadow,left,top] duration-150 outline-none focus-visible:ring-2 focus-visible:ring-ring"
            style={{
                cursor: onPress ? 'grab' : 'pointer',
                left: box.x,
                top: box.y,
                width: box.w,
                height: box.h,
                borderRadius:
                    c.shape === 'dpad'
                        ? 12
                        : controlRadius(c.shape, box.w, box.h),
                transform: `rotate(${c.r ?? 0}deg)${pressed ? ' scale(.93)' : ''}`,
                boxShadow: shadowOf(col, { selected, hovered, pressed, flat }),
                ...surfaceStyle(c, box, col, selected || hovered),
            }}
        >
            {Inset ? <Inset {...body} /> : null}
            {c.shape !== 'stick' && c.shape !== 'key' && !flat ? (
                <Glyph c={c} box={box} col={col} />
            ) : null}
        </button>
    )
}

export const ControlShape = memo(ControlShapeView)
