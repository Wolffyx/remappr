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

/** What a slider shows, from its parts: shared by the editor (runtime
 *  bindings) and the builder (the design's own). */
export function buildSliderLegend(b: {
    map?: SliderMap
    min?: number
    max?: number
    up?: KnobSide
    down?: KnobSide
    follow?: SliderLegend['motor']
}): SliderLegend {
    const motor = b.follow
    if (!b.map)
        return { title: 'Slider', kind: 'none', category: 'alpha', motor }
    const info = sliderMapInfo(b.map)
    if (info.id === 'keys')
        return {
            title: 'Slider',
            kind: 'keys',
            up: b.up,
            down: b.down,
            category: b.up?.category ?? b.down?.category ?? 'alpha',
            motor,
        }
    return {
        title: info.label,
        kind: 'level',
        range:
            b.min !== undefined || b.max !== undefined
                ? `${b.min ?? 0}–${b.max ?? 100}`
                : undefined,
        category: LEVEL_CATEGORY[info.id] ?? 'system',
        motor,
    }
}

/** A runtime slider binding's legend (the editor). */
export function sliderLegend(
    action: SliderAction | undefined,
    motor?: PhysicalLayoutKey['motor'],
): SliderLegend {
    return buildSliderLegend({
        map: action?.map as SliderMap | undefined,
        min: action?.min,
        max: action?.max,
        up: action?.up ? knobSide(action.up.label) : undefined,
        down: action?.down ? knobSide(action.down.label) : undefined,
        follow: motor?.follow,
    })
}
