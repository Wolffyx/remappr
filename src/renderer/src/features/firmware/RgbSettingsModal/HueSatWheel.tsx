// pattern-check: skip — controlled pointer/keyboard widget over the pure colourWheel helpers
//
// Hue/saturation wheel: drag anywhere on it, or use the arrow keys (left/right
// turn the hue, up/down change how strong the colour is). The gradients are the
// light itself, so they are drawn in real colours, not theme tokens.
import { useRef } from 'react'

import { cn } from '@/lib/cn'

import {
    colourName,
    hueSatToPoint,
    lightCss,
    pointToHueSat,
    type HueSat,
} from './colourWheel'

const SIZE = 184

const WHEEL_BG = [
    'radial-gradient(circle closest-side, hsl(0 0% 100%), hsl(0 0% 100% / 0))',
    `conic-gradient(${[0, 60, 120, 180, 240, 300, 360]
        .map((h) => `hsl(${h} 100% 50%)`)
        .join(', ')})`,
].join(', ')

const KEY_STEP: Readonly<Record<string, Partial<HueSat>>> = {
    ArrowLeft: { hue: -5 },
    ArrowRight: { hue: 5 },
    ArrowUp: { saturation: 5 },
    ArrowDown: { saturation: -5 },
}

export function HueSatWheel({
    value,
    onChange,
    disabled = false,
}: {
    value: HueSat
    onChange: (next: HueSat) => void
    disabled?: boolean
}): JSX.Element {
    const ref = useRef<HTMLDivElement>(null)
    const pin = hueSatToPoint(value, SIZE)

    const pick = (e: React.PointerEvent): void => {
        const box = ref.current?.getBoundingClientRect()
        if (!box) return
        const scale = SIZE / box.width
        onChange(
            pointToHueSat(
                (e.clientX - box.left) * scale,
                (e.clientY - box.top) * scale,
                SIZE,
            ),
        )
    }

    const onKey = (e: React.KeyboardEvent): void => {
        const step = KEY_STEP[e.key]
        if (!step) return
        e.preventDefault()
        onChange({
            hue: (value.hue + (step.hue ?? 0) + 360) % 360,
            saturation: Math.min(
                100,
                Math.max(0, value.saturation + (step.saturation ?? 0)),
            ),
        })
    }

    return (
        <div
            ref={ref}
            role="slider"
            tabIndex={disabled ? -1 : 0}
            aria-label="Colour"
            aria-disabled={disabled}
            aria-valuemin={0}
            aria-valuemax={360}
            aria-valuenow={value.hue}
            aria-valuetext={`${colourName(value)}, hue ${value.hue}°, saturation ${value.saturation}%`}
            onPointerDown={(e) => {
                if (disabled) return
                e.currentTarget.setPointerCapture(e.pointerId)
                pick(e)
            }}
            onPointerMove={(e) => {
                if (disabled || !e.currentTarget.hasPointerCapture(e.pointerId))
                    return
                pick(e)
            }}
            onKeyDown={disabled ? undefined : onKey}
            className={cn(
                'relative shrink-0 touch-none rounded-full shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--foreground)_15%,transparent)] outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                disabled ? 'cursor-not-allowed opacity-40' : 'cursor-crosshair',
            )}
            style={{ width: SIZE, height: SIZE, background: WHEEL_BG }}
        >
            <span
                className="pointer-events-none absolute size-[18px] -translate-x-1/2 -translate-y-1/2 rounded-full shadow-[0_0_0_2px_white,0_0_0_3px_rgb(0_0_0/.45),0_2px_6px_rgb(0_0_0/.45)]"
                style={{ left: pin.x, top: pin.y, background: lightCss(value) }}
            />
        </div>
    )
}
