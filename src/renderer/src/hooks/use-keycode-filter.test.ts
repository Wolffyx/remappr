// Picker tiles of a behavior family the keyboard was built without are hidden,
// and a page the gate empties goes with them.
import { describe, expect, it } from 'vitest'

import type { CatalogEntry, CatalogPage } from '@firmware/catalog/types'

import { filterPagesByBehaviorFlags } from './use-keycode-filter'

const tile = (id: string): CatalogEntry => ({ id, label: id }) as CatalogEntry
const page = (id: string, ids: string[]): CatalogPage =>
    ({
        id,
        name: id,
        style: 'flat-grid',
        visible: true,
        entries: ids.map(tile),
    }) as CatalogPage

const PAGES = [
    page('macros', ['macro.pool.0', 'macro.dynamic.play_1']),
    page('combos', ['combo.on']),
    page('quantum', [
        'leader.start',
        'unicode.mode.next',
        'key_override.on',
        'auto_shift.toggle',
        'caps_word.toggle',
    ]),
]

const ids = (pages: CatalogPage[]): string[][] =>
    pages.map((p) => p.entries.map((e) => e.id))

describe('filterPagesByBehaviorFlags', () => {
    it('keeps everything without flags or with every family present', () => {
        expect(filterPagesByBehaviorFlags(PAGES, undefined)).toBe(PAGES)
        expect(
            ids(
                filterPagesByBehaviorFlags(PAGES, {
                    macros: true,
                    combos: true,
                }),
            ),
        ).toEqual(ids(PAGES))
    })

    it('drops a built-out family and the page it empties', () => {
        const out = filterPagesByBehaviorFlags(PAGES, {
            macros: false,
            combos: false,
        })
        expect(out.map((p) => p.id)).toEqual(['quantum'])
    })

    it('hides each family prefix', () => {
        const out = filterPagesByBehaviorFlags(PAGES, {
            sequences: false,
            unicode: false,
            keyOverrides: false,
            tapHold: false,
        })
        expect(ids(out)[2]).toEqual(['caps_word.toggle'])
    })
})
