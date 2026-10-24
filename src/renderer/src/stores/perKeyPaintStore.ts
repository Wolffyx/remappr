// pattern-check: skip — non-persisted zustand state slice for per-key RGB paint mode
import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import type { HsvColor } from '@firmware/service'

/**
 * Editor "paint mode" state for assigning per-key RGB colours on the keyboard
 * canvas. Colours are keyed by physical-layout key index (the canvas idx) in
 * device HSV units (0–255), matching RgbApi.setPerKeyColors. Session-only — the
 * source of truth is the keyboard; this just holds the in-flight edits + brush.
 */
interface PerKeyPaintState {
    active: boolean
    /** Current brush colour (device HSV 0–255). */
    brush: HsvColor
    /** canvas idx → colour. */
    colors: Record<number, HsvColor>
    setActive: (active: boolean) => void
    setBrush: (c: HsvColor) => void
    /** Apply the current brush to a key. */
    paint: (idx: number) => void
    /** Paint the brush onto every given key index. */
    fillAll: (idxs: number[]) => void
    /** Seed from device-read colours (canvas-idx keyed). */
    load: (colors: Record<number, HsvColor>) => void
    reset: () => void
}

const DEFAULT_BRUSH: HsvColor = { h: 0, s: 255, v: 255 }

const usePerKeyPaintStore = create<PerKeyPaintState>()(
    devtools((set) => ({
        active: false,
        brush: DEFAULT_BRUSH,
        colors: {},
        setActive: (active) => set({ active }),
        setBrush: (brush) => set({ brush }),
        paint: (idx) =>
            set((s) => ({ colors: { ...s.colors, [idx]: { ...s.brush } } })),
        fillAll: (idxs) =>
            set((s) => {
                const next = { ...s.colors }
                for (const i of idxs) next[i] = { ...s.brush }
                return { colors: next }
            }),
        load: (colors) => set({ colors }),
        reset: () => set({ colors: {}, brush: DEFAULT_BRUSH }),
    })),
)

export default usePerKeyPaintStore
