// pattern-check: skip — unit tests for the lighting effect groups and colour wheel.
import { describe, expect, it } from 'vitest'
import { RGB_MATRIX_EFFECTS } from '@firmware/lighting'

import {
    colourName,
    hueSatToPoint,
    lightCss,
    pointToHueSat,
} from './colourWheel'
import { groupEffects, groupOf, plainName, previewOf } from './effectGroups'

describe('effect groups', () => {
    it('sorts effect names into groups people recognise', () => {
        expect(groupOf('Solid Color')).toBe('Basic')
        expect(groupOf('Breathing')).toBe('Basic')
        expect(groupOf('Solid Reactive Simple')).toBe('Reactive')
        expect(groupOf('Rainbow Beacon')).toBe('Rainbow cycle')
        expect(groupOf('Jellybean Raindrops')).toBe('Rain & pixels')
        expect(groupOf('Digital Rain')).toBe('Rain & pixels')
        expect(groupOf('Band Pinwheel Sat')).toBe('Band')
        expect(groupOf('Gradient Up Down')).toBe('Gradient')
        expect(groupOf('Static Gradient')).toBe('Gradient')
        expect(groupOf('Something New')).toBe('Other')
    })

    it('writes names in plain words', () => {
        expect(plainName('Cycle_Left_Right')).toBe('Cycle left–right')
        expect(plainName('Band Sat')).toBe('Band saturation')
        expect(plainName('Band Spiral Val')).toBe('Band spiral brightness')
        expect(plainName('Solid Color')).toBe('Solid colour')
        expect(plainName('Cycle Up Down')).toBe('Cycle up–down')
    })

    it('keeps every catalog effect, each once, with its mode index', () => {
        const groups = groupEffects(RGB_MATRIX_EFFECTS)
        const indexes = groups.flatMap((g) => g.items.map((e) => e.index))
        expect(indexes.sort((a, b) => a - b)).toEqual(
            RGB_MATRIX_EFFECTS.map((_, i) => i),
        )
        expect(groups.every((g) => g.items.length > 0)).toBe(true)
    })

    it('searches the plain label and the firmware name', () => {
        const fx = ['Band Sat', 'Cycle All', 'Breathing']
        expect(
            groupEffects(fx, 'saturation').flatMap((g) => g.items),
        ).toMatchObject([{ index: 0 }])
        expect(groupEffects(fx, 'sat').flatMap((g) => g.items)).toHaveLength(1)
        expect(groupEffects(fx, 'zzz')).toEqual([])
    })

    it('previews moving effects as moving and breathing as a pulse', () => {
        expect(previewOf('Cycle All', 0).motion).toBe('move')
        expect(previewOf('Breathing', 0).motion).toBe('pulse')
        expect(previewOf('Solid Color', 0).motion).toBe('none')
    })
})

describe('colour wheel', () => {
    it('puts hue round the wheel from the top and saturation outwards', () => {
        expect(pointToHueSat(100, 0, 200)).toEqual({ hue: 0, saturation: 100 })
        expect(pointToHueSat(200, 100, 200)).toEqual({
            hue: 90,
            saturation: 100,
        })
        expect(pointToHueSat(100, 100, 200).saturation).toBe(0)
        expect(pointToHueSat(100, 150, 200)).toEqual({
            hue: 180,
            saturation: 50,
        })
    })

    it('round-trips a colour through its point', () => {
        const c = { hue: 200, saturation: 45 }
        const p = hueSatToPoint(c, 184)
        expect(pointToHueSat(p.x, p.y, 184)).toEqual(c)
    })

    it('clamps points outside the rim to full saturation', () => {
        expect(pointToHueSat(100, -50, 200).saturation).toBe(100)
    })

    it('names colours in plain words', () => {
        expect(colourName({ hue: 200, saturation: 45 })).toBe('Ice blue')
        expect(colourName({ hue: 3, saturation: 98 })).toBe('Red')
        expect(colourName({ hue: 140, saturation: 5 })).toBe('White')
        expect(colourName({ hue: 10, saturation: 30 })).toBe('Pale red')
        expect(colourName({ hue: 300, saturation: 90 })).toBe('Magenta')
    })

    it('draws a colour as the light it gives at full brightness', () => {
        expect(lightCss({ hue: 120, saturation: 100 })).toBe(
            'hsl(120 100% 50%)',
        )
        expect(lightCss({ hue: 0, saturation: 0 })).toBe('hsl(0 100% 100%)')
    })
})
