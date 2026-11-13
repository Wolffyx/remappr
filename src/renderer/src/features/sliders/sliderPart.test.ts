// pattern-check: skip unit test
import { describe, expect, it } from 'vitest'
import type { SensorInfo } from '@firmware/devices/types'
import { sliderPartOf } from './model'

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
