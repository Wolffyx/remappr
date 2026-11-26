// pattern-check: skip — controlled HSV picker widget; pointer-drag + conversions, no abstraction
import { useEffect, useRef, useState } from 'react'

import type { HsvColor } from '@firmware/service'

import { hexToHsv, hsvToCss, hsvToHex, hsvToRgb, rgbToHsv } from './hsv'

interface Props {
    value: HsvColor
    onChange: (next: HsvColor) => void
}

const clamp01 = (n: number): number => Math.min(1, Math.max(0, n))
const clamp255 = (n: number): number =>
    Math.min(255, Math.max(0, Math.round(n)))

/**
 * HSV colour picker — a 2-D saturation/value field, a vertical hue bar, and
 * hex + R/G/B numeric inputs. Operates on the Keychron wire format (h/s/v each
 * 0..255). Fully controlled: every interaction calls `onChange`.
 */
export function ColorPicker({ value, onChange }: Props): JSX.Element {
    const huePure = hsvToCss({ h: value.h, s: 255, v: 255 })
    const rgb = hsvToRgb(value)
    const hex = hsvToHex(value)

    // Local hex draft so the user can type freely without it snapping back.
    const [hexDraft, setHexDraft] = useState(hex)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    useEffect(() => setHexDraft(hex), [hex])

    // ----- drag plumbing -----
    // pattern-check: skip — currentTarget-based pointer drag, no abstraction
    // Tracks pointer over the element the gesture started on (via currentTarget)
    // and reports normalised 0..1 coordinates until release. The active drag's
    // teardown is kept in a ref so unmounting mid-drag (modal closed with the
    // button still down) removes the window listeners instead of leaking them.
    const dragCleanupRef = useRef<(() => void) | null>(null)
    useEffect(() => (): void => dragCleanupRef.current?.(), [])
    /* eslint-disable react-hooks/refs -- the ref reads/writes below live in the
       pointerdown/pointerup handlers (event time), not render; the rule can't
       see through the curried handler factory. */
    const startDrag =
        (apply: (x: number, y: number) => void) =>
        (e: React.PointerEvent<HTMLDivElement>): void => {
            e.preventDefault()
            const el = e.currentTarget
            const at = (clientX: number, clientY: number): void => {
                const r = el.getBoundingClientRect()
                apply(
                    clamp01((clientX - r.left) / r.width),
                    clamp01((clientY - r.top) / r.height),
                )
            }
            at(e.clientX, e.clientY)
            const move = (ev: PointerEvent): void => at(ev.clientX, ev.clientY)
            const stop = (): void => {
                window.removeEventListener('pointermove', move)
                window.removeEventListener('pointerup', stop)
                dragCleanupRef.current = null
            }
            dragCleanupRef.current?.()
            dragCleanupRef.current = stop
            window.addEventListener('pointermove', move)
            window.addEventListener('pointerup', stop)
        }
    /* eslint-enable react-hooks/refs */

    // SV drag preserves h, hue drag preserves s/v — those channels stay constant
    // during their own gesture, so closing over `value` directly is correct.
    const onSvDrag = startDrag((x, y) =>
        onChange({
            ...value,
            s: clamp255(x * 255),
            v: clamp255((1 - y) * 255),
        }),
    )
    const onHueDrag = startDrag((_x, y) =>
        onChange({ ...value, h: clamp255(y * 255) }),
    )

    const setChannel = (key: 'r' | 'g' | 'b', n: number): void =>
        onChange(rgbToHsv({ ...rgb, [key]: clamp255(n) }))

    const svX = (value.s / 255) * 100
    const svY = (1 - value.v / 255) * 100
    const hueY = (value.h / 255) * 100

    return (
        <div className="flex gap-3">
            {/* saturation / value field */}
            <div
                onPointerDown={onSvDrag}
                className="relative h-40 flex-1 cursor-crosshair rounded-xl border touch-none"
                style={{
                    backgroundColor: huePure,
                    backgroundImage:
                        'linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, transparent)',
                }}
            >
                <span
                    className="pointer-events-none absolute size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,.4)]"
                    style={{ left: `${svX}%`, top: `${svY}%` }}
                />
            </div>

            {/* hue bar */}
            <div
                onPointerDown={onHueDrag}
                className="relative w-3.5 shrink-0 cursor-pointer rounded-full border touch-none"
                style={{
                    backgroundImage:
                        'linear-gradient(to bottom, #f00 0%, #ff0 17%, #0f0 33%, #0ff 50%, #00f 67%, #f0f 83%, #f00 100%)',
                }}
            >
                <span
                    className="pointer-events-none absolute left-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,.4)]"
                    style={{ top: `${hueY}%` }}
                />
            </div>

            {/* numeric inputs */}
            <div className="flex w-32 shrink-0 flex-col gap-2">
                <div
                    className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-white"
                    style={{ backgroundColor: hsvToCss(value) }}
                >
                    <span className="opacity-80">#</span>
                    <input
                        value={hexDraft.replace(/^#/, '')}
                        spellCheck={false}
                        maxLength={6}
                        onChange={(e): void => {
                            const t = e.currentTarget.value
                            setHexDraft(t)
                            const parsed = hexToHsv(t)
                            if (parsed) onChange(parsed)
                        }}
                        className="w-full bg-transparent text-right font-mono uppercase outline-none placeholder:text-white/50"
                        aria-label="Hex colour"
                    />
                </div>
                {(['r', 'g', 'b'] as const).map((ch) => (
                    <label
                        key={ch}
                        className="flex items-center gap-2 rounded-lg border bg-secondary px-3 py-2 text-sm focus-within:border-primary"
                    >
                        <span className="eyebrow">{ch}</span>
                        <input
                            type="number"
                            min={0}
                            max={255}
                            value={rgb[ch]}
                            onChange={(e): void =>
                                setChannel(ch, Number(e.currentTarget.value))
                            }
                            className="w-full bg-transparent text-right tabular-nums outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
                            aria-label={`${ch.toUpperCase()} channel`}
                        />
                    </label>
                ))}
            </div>
        </div>
    )
}
