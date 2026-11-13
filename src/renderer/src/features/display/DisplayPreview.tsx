// Pattern check: no GoF pattern (-) — rejected — presentational canvas view; drawing goes through the adapter's ScreensApi.
//
// One display drawn pixel for pixel as the device draws it (the adapter's
// ScreensApi follows the firmware's own drawing), magnified. Clicking the
// panel picks the widget under the pointer; the picked one is outlined.
import { JSX, useEffect, useMemo, useRef } from 'react'
import type { ConfigScreenPage } from '@firmware/config/types'
import type { ScreenPreviewValue, ScreensApi } from '@firmware/service'
import { widgetAt } from './displayModel'

/** Panel colours: a monochrome OLED, lit pixels light on black. */
const LIT = [214, 236, 255, 255]
const DARK = [6, 8, 12, 255]

export function DisplayPreview({
    screens,
    width,
    height,
    rotation,
    invert,
    page,
    values,
    selected,
    onSelect,
}: {
    screens: ScreensApi
    width: number
    height: number
    rotation: number
    invert: boolean
    page: ConfigScreenPage | undefined
    values: (source: string) => ScreenPreviewValue | undefined
    selected: number
    onSelect: (widget: number) => void
}): JSX.Element {
    const ref = useRef<HTMLCanvasElement>(null)
    // As big as fits the dialog: whole pixels per panel pixel.
    const scale = Math.max(1, Math.min(4, Math.floor(520 / width)))
    const pixels = useMemo(
        () => screens.render(page, { width, height, rotation, invert, values }),
        [screens, page, width, height, rotation, invert, values],
    )
    useEffect(() => {
        const ctx = ref.current?.getContext('2d')
        if (!ctx) return
        const img = ctx.createImageData(width, height)
        pixels.forEach((on, i) => img.data.set(on ? LIT : DARK, i * 4))
        ctx.putImageData(img, 0, 0)
    }, [pixels, width, height])

    const w = page?.widgets[selected]
    const at = { width, height, rotation }
    const box = w ? screens.panelBox(w, at) : null
    const pick = (e: React.MouseEvent<HTMLCanvasElement>): void => {
        const r = e.currentTarget.getBoundingClientRect()
        const px = Math.floor(((e.clientX - r.left) / r.width) * width)
        const py = Math.floor(((e.clientY - r.top) / r.height) * height)
        const l = screens.panelToLogical(px, py, at)
        if (page) onSelect(widgetAt(page, l.x, l.y))
    }
    return (
        <div className="flex justify-center rounded-lg bg-black/90 p-3">
            <div
                className="relative"
                style={{ width: width * scale, height: height * scale }}
            >
                <canvas
                    ref={ref}
                    width={width}
                    height={height}
                    onClick={pick}
                    aria-label={`Display preview, ${width} by ${height} pixels`}
                    className="size-full cursor-crosshair [image-rendering:pixelated]"
                />
                {box && (
                    <div
                        aria-hidden
                        className="pointer-events-none absolute outline outline-1 outline-primary"
                        style={{
                            left: box.x * scale,
                            top: box.y * scale,
                            width: box.w * scale,
                            height: box.h * scale,
                        }}
                    />
                )}
            </div>
        </div>
    )
}
