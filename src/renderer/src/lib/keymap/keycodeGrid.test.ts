// pattern-check: skip — assertions over the picker search ranking
import { describe, expect, it } from 'vitest'
import type { CatalogEntry } from '@firmware/catalog/types'
import { filterKeysBySearch } from './keycodeGrid'

const entry = (id: string, label: string, name = id): CatalogEntry => ({
    id,
    label,
    name,
    kinds: [],
})

describe('filterKeysBySearch', () => {
    it('ranks an exact label match first', () => {
        const keys = [
            entry('TAB', 'Tab', 'Keyboard Tab'),
            entry('T', 'T', 'Keyboard t and T'),
        ]
        expect(filterKeysBySearch(keys, 't').map((k) => k.id)).toEqual([
            'T',
            'TAB',
        ])
    })

    // Labels are plain text: a legend holding both brackets (the ISO `< >`
    // key) must not be read as a tag and dropped from the results.
    it('matches legends made of angle brackets', () => {
        const keys = [
            entry('A', 'A'),
            entry('COMMA', ', <'),
            entry('NUBS', '< >'),
        ]
        expect(filterKeysBySearch(keys, '<').map((k) => k.id)).toEqual([
            'NUBS',
            'COMMA',
        ])
        expect(filterKeysBySearch(keys, '< >').map((k) => k.id)).toEqual([
            'NUBS',
        ])
    })
})
