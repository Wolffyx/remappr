// pattern-check: skip — unit tests for the dynamic-entry table model.
import { describe, expect, it } from 'vitest'

import {
    firstFree,
    loadAll,
    sameEntry,
    saveDrafts,
    usedCount,
    visibleRows,
} from './entryTable'

const isEmpty = (n: number): boolean => n === 0
const slots = [5, 0, 7, 0, 0]

describe('entry table model', () => {
    it('lists only slots in use, plus revealed empty ones, in order', () => {
        expect(visibleRows(slots, isEmpty, new Set())).toEqual([0, 2])
        expect(visibleRows(slots, isEmpty, new Set([3]))).toEqual([0, 2, 3])
    })

    it('counts slots in use', () => {
        expect(usedCount(slots, isEmpty)).toBe(2)
        expect(usedCount([undefined, 1], isEmpty)).toBe(1)
    })

    it('finds the first free slot, skipping ones already listed', () => {
        expect(firstFree(slots, isEmpty)).toBe(1)
        expect(firstFree(slots, isEmpty, new Set([1]))).toBe(3)
        expect(firstFree([1, 2], isEmpty)).toBeNull()
    })

    it('compares entries by content', () => {
        expect(sameEntry({ a: [1, 2] }, { a: [1, 2] })).toBe(true)
        expect(sameEntry({ a: [1, 2] }, { a: [2, 1] })).toBe(false)
    })

    it('reads every slot in order and stops when cancelled', async () => {
        const seen: number[] = []
        const all = await loadAll(
            3,
            async (i) => (seen.push(i), i * 10),
            () => false,
        )
        expect(all).toEqual([0, 10, 20])
        expect(seen).toEqual([0, 1, 2])
        let stop = false
        const part = await loadAll(
            3,
            async (i) => {
                stop = i === 1
                return i
            },
            () => stop,
        )
        expect(part).toBeNull()
    })

    it('ends a pool of unknown size at the first slot the device refuses', async () => {
        const fetch = async (i: number): Promise<number> => {
            if (i >= 4) throw new Error('out of range')
            return i
        }
        expect(await loadAll(32, fetch, () => false, true)).toEqual([
            0, 1, 2, 3,
        ])
        await expect(loadAll(32, fetch, () => false)).rejects.toThrow(
            'out of range',
        )
        const none = async (): Promise<number> => {
            throw new Error('no support')
        }
        await expect(loadAll(32, none, () => false, true)).rejects.toThrow(
            'no support',
        )
    })

    it('saves drafts in slot order and keeps the rest after a failure', async () => {
        const written: number[] = []
        const drafts = new Map([
            [4, 'd'],
            [1, 'b'],
            [2, 'c'],
        ])
        const ok = await saveDrafts(drafts, async (i) => {
            written.push(i)
        })
        expect(ok).toEqual({ saved: [1, 2, 4], error: undefined })
        expect(written).toEqual([1, 2, 4])

        const boom = new Error('nope')
        const bad = await saveDrafts(drafts, async (i) => {
            if (i === 2) throw boom
        })
        expect(bad).toEqual({ saved: [1], error: boom })
    })
})
