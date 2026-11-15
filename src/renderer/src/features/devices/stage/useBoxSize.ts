// Pattern check: no GoF pattern (-) — rejected — small ResizeObserver hook with one caller (DeviceStage), rAF-batched and snapped to 4px.
import { useLayoutEffect, useState, type RefObject } from 'react'

export interface BoxSize {
    w: number
    h: number
}

/** The element's client size, re-measured on resize (snapped to 4px so a
 *  scrollbar flicker does not re-layout the stage every frame). */
export function useBoxSize(ref: RefObject<HTMLElement | null>): BoxSize {
    const [size, setSize] = useState<BoxSize>({ w: 800, h: 600 })
    useLayoutEffect(() => {
        const el = ref.current
        if (!el) return
        let raf = 0
        const measure = (): void => {
            cancelAnimationFrame(raf)
            raf = requestAnimationFrame(() => {
                const w = Math.round(el.clientWidth / 4) * 4
                const h = Math.round(el.clientHeight / 4) * 4
                setSize((s) => (s.w === w && s.h === h ? s : { w, h }))
            })
        }
        measure()
        const ro = new ResizeObserver(measure)
        ro.observe(el)
        return () => {
            cancelAnimationFrame(raf)
            ro.disconnect()
        }
    }, [ref])
    return size
}
