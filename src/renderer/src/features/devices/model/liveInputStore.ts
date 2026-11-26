// Pattern check: no GoF pattern (-) — rejected — session-only zustand slice holding the latest live input frame; per-control selectors keep re-renders local.
//
// The latest live input of the connected device (which controls are held, the
// analog values). Each drawn control selects only its own entry, so a frame
// re-renders the controls that changed, not the whole stage.
import { create } from 'zustand'
import type { AnalogValue, ControlInputFrame } from '@firmware/devices/types'

interface LiveInputState {
    pressed: ReadonlySet<string>
    analog: Readonly<Record<string, AnalogValue>>
    setFrame: (frame: ControlInputFrame) => void
    clear: () => void
}

const EMPTY: ReadonlySet<string> = new Set()

const useLiveInputStore = create<LiveInputState>()((set) => ({
    pressed: EMPTY,
    analog: {},
    setFrame: (frame) => set({ pressed: frame.pressed, analog: frame.analog }),
    clear: () => set({ pressed: EMPTY, analog: {} }),
}))

/** Whether control `id` is held right now (false while `live` is off). */
export const useControlPressed = (id: string, live: boolean): boolean =>
    useLiveInputStore((s) => live && s.pressed.has(id))

/** Control `id`'s analog value (undefined while `live` is off). */
export const useControlAnalog = (
    id: string,
    live: boolean,
): AnalogValue | undefined =>
    useLiveInputStore((s) => (live ? s.analog[id] : undefined))

/** An analog value as a 2-D deflection (a 1-D value moves along x). */
export function analogXY(v: AnalogValue | undefined): { x: number; y: number } {
    if (v === undefined) return { x: 0, y: 0 }
    return typeof v === 'number' ? { x: v, y: 0 } : v
}

export default useLiveInputStore
