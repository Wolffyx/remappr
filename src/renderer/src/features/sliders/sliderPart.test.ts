// pattern-check: skip unit test
import { describe, expect, it } from 'vitest'
import type { SensorInfo } from '@firmware/devices/types'
import { clampSteps, sliderPartOf } from './model'

const part = (index: number, cls: string): SensorInfo =>
    ({ index, cls }) as unknown as SensorInfo

describe('sliderPartOf', () => {
    it('slot n drives the n-th SLIDER part, whatever else the device has', () => {
        const parts = [
            part(0, 'display'),
            part(1, 'slider'),
            part(2, 'matrix'),
            part(3, 'slider'),
        ]
        expect(sliderPartOf(parts, 0)?.index).toBe(1)
        expect(sliderPartOf(parts, 1)?.index).toBe(3)
        expect(sliderPartOf(parts, 2)).toBeNull()
        expect(sliderPartOf([], 0)).toBeNull()
    })
})

describe('clampSteps', () => {
    it('keeps a typed step count a whole number the firmware takes', () => {
        expect(clampSteps(20, 100)).toBe(20)
        expect(clampSteps(0, 100)).toBe(1)
        expect(clampSteps(-5, 100)).toBe(1)
        expect(clampSteps(250, 100)).toBe(100)
        expect(clampSteps(12.6, 100)).toBe(13)
        expect(clampSteps(Number.NaN, 100)).toBe(1)
    })
})
