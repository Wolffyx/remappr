// pattern-check: skip vitest cases over the slider slot lookups
import { describe, expect, it } from 'vitest'
import type { Layer, PhysicalLayout } from '@firmware/types'
import {
    effectiveSlider,
    freeSliderBoxes,
    freeSliderSlots,
    sliderSlotAt,
} from './model'

const key = { x: 0, y: 0, w: 100, h: 100 }
// Keys 0..2; slot 0 is key 2, slot 1 a fader of its own, slot 2 key 1.
const LAYOUT: PhysicalLayout = {
    id: 0,
    name: 'L',
    keys: [key, { ...key, element: 'slider' }, { ...key, element: 'slider' }],
    sliders: [
        { x: 200, y: 0, key: 2 },
        { x: 650, y: 0, w: 50, h: 400 },
        { x: 100, y: 0, key: 1 },
    ],
}

describe('slider slots on the stage', () => {
    it('finds a slider key’s slot, and a free slider drawn after the keys', () => {
        expect(freeSliderSlots(LAYOUT)).toEqual([1])
        expect(sliderSlotAt(LAYOUT, 2)).toBe(0)
        expect(sliderSlotAt(LAYOUT, 1)).toBe(2)
        expect(sliderSlotAt(LAYOUT, 3)).toBe(1)
        expect(sliderSlotAt(LAYOUT, 0)).toBe(-1)
        expect(sliderSlotAt(LAYOUT, 4)).toBe(-1)
        expect(sliderSlotAt(undefined, 0)).toBe(-1)
    })

    it('previews draw a free slider’s box in keyboard units', () => {
        expect(freeSliderBoxes(LAYOUT)).toEqual([
            { x: 6.5, y: 0, width: 0.5, height: 4 },
        ])
        expect(freeSliderBoxes(undefined)).toEqual([])
    })

    it('a layer that sets nothing follows the base layer', () => {
        const layers = [
            {
                id: 0,
                name: 'base',
                keys: [],
                sliders: [{ map: 'volume' }, null],
            },
            {
                id: 1,
                name: 'fn',
                keys: [],
                sliders: [null, { map: 'rgb_hue' }],
            },
        ] as Layer[]
        expect(effectiveSlider(layers, 1, 0)).toEqual({ map: 'volume' })
        expect(effectiveSlider(layers, 1, 1)).toEqual({ map: 'rgb_hue' })
        expect(effectiveSlider(layers, 0, 1)).toBeUndefined()
    })
})
