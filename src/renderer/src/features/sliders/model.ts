// Pattern check: no GoF pattern (-) — rejected — a direction table, a one-slot store and pure legend mappers; data plus functions.
//
// The app's description of a slider: its two directions (the halves of the cap
// and the editor's chips), which one is being edited, and what the cap shows
// for a layer's binding. Map ids and labels come from the config's own
// SLIDER_MAP_INFO, so the cap, the editor and the builder say the same thing.
import { create } from 'zustand'
import type { PhysicalLayoutKey, SliderAction } from '@firmware/types'
import { sliderMapInfo, type SliderMap } from '@firmware/config'
import { knobSide, type KnobSide } from '@/features/encoders/knobLegend'
import type { KeyCategory } from '@/lib/keymap/keyCategory'

export type SliderDir = 'down' | 'up'

export const SLIDER_DIRS: readonly {
    dir: SliderDir
    short: string
    long: string
}[] = [
    { dir: 'down', short: 'Down', long: 'Sliding down' },
    { dir: 'up', short: 'Up', long: 'Sliding up' },
]

/** Which direction the editor is on; the cap's halves set it before they
 *  select the slider's position. */
export const useSliderDirStore = create<{
    dir: SliderDir
    setDir: (dir: SliderDir) => void
}>()((set) => ({ dir: 'up', setDir: (dir) => set({ dir }) }))

/** What a slider cap shows on the active layer. */
export interface SliderLegend {
    /** Header: the level's name, or "Slider" for keys. */
    title: string
    kind: 'level' | 'keys' | 'none'
    up?: KnobSide
    down?: KnobSide
    /** A level's range, e.g. "0–100". */
    range?: string
    category: KeyCategory
    motor?: NonNullable<PhysicalLayoutKey['motor']>['follow']
}

/** A level's tint follows whose level it is: media for the computer's, lighting
 *  for the keyboard's own, mouse for scrolling. */
const LEVEL_CATEGORY: Partial<Record<SliderMap, KeyCategory>> = {
    volume: 'media',
    brightness: 'media',
    backlight: 'light',
    rgb_brightness: 'light',
    rgb_hue: 'light',
    mouse_wheel: 'mouse',
}

export function sliderLegend(
    action: SliderAction | undefined,
    motor?: PhysicalLayoutKey['motor'],
): SliderLegend {
    const follow = motor?.follow
    if (!action)
        return {
            title: 'Slider',
            kind: 'none',
            category: 'alpha',
            motor: follow,
        }
    const info = sliderMapInfo(action.map as SliderMap)
    if (info.id === 'keys') {
        const up = action.up ? knobSide(action.up.label) : undefined
        const down = action.down ? knobSide(action.down.label) : undefined
        return {
            title: 'Slider',
            kind: 'keys',
            up,
            down,
            category: up?.category ?? down?.category ?? 'alpha',
            motor: follow,
        }
    }
    return {
        title: info.label,
        kind: 'level',
        range:
            action.min !== undefined || action.max !== undefined
                ? `${action.min ?? 0}–${action.max ?? 100}`
                : undefined,
        category: LEVEL_CATEGORY[info.id] ?? 'system',
        motor: follow,
    }
}
