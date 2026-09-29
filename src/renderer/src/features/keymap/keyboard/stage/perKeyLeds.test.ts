// Pattern check: no GoF pattern (-) — rejected — unit tests for the pure key→LED helpers, no abstraction.
import { describe, it, expect } from 'vitest'

import type { HsvColor } from '@firmware/service'
import { identityKeyLeds, ledRuns, ledSpan } from './perKeyLeds'

const c = (h: number): HsvColor => ({ h, s: 255, v: 255 })

describe('perKeyLeds', () => {
    it('maps each key to its own LED without a firmware map', () => {
        expect(identityKeyLeds(3)).toEqual([[0], [1], [2]])
    })

    it('groups consecutive LEDs into runs, in LED order', () => {
        const writes = new Map([
            [5, c(5)],
            [0, c(0)],
            [1, c(1)],
            [3, c(3)],
            [4, c(4)],
        ])
        expect(ledRuns(writes, 9)).toEqual([
            { start: 0, colors: [c(0), c(1)] },
            { start: 3, colors: [c(3), c(4), c(5)] },
        ])
    })

    it('splits a run at the batch limit', () => {
        const writes = new Map([0, 1, 2, 3, 4].map((l) => [l, c(l)]))
        expect(ledRuns(writes, 2).map((r) => r.start)).toEqual([0, 2, 4])
    })

    it('covers the highest LED of any key, spacebar extras included', () => {
        // Keycult TKL: the spacebar's extra LEDs sit past the last key.
        expect(ledSpan([[0], [1, 88], [2, 87, 89], []])).toBe(90)
        expect(ledSpan([])).toBe(0)
    })
})
