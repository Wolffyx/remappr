import { describe, it, expect } from 'vitest'
import {
    abbreviateKeyName,
    abbreviateLayerName,
    formatMomentaryLayer,
} from './keyAbbreviations'

describe('abbreviateKeyName', () => {
    it('returns canonical abbreviation for known names', () => {
        expect(abbreviateKeyName('Backspace')).toBe('BkSp')
        expect(abbreviateKeyName('Delete')).toBe('Del')
        expect(abbreviateKeyName('Escape')).toBe('Esc')
        expect(abbreviateKeyName('Page Up')).toBe('PgUp')
        expect(abbreviateKeyName('Page Down')).toBe('PgDn')
        expect(abbreviateKeyName('Left Shift')).toBe('LShft')
        expect(abbreviateKeyName('Right Control')).toBe('RCtrl')
    })

    it('matches case-insensitively', () => {
        expect(abbreviateKeyName('backspace')).toBe('BkSp')
        expect(abbreviateKeyName('PAGE UP')).toBe('PgUp')
        expect(abbreviateKeyName('left ALT')).toBe('LAlt')
    })

    it('matches alternate spellings without spaces', () => {
        expect(abbreviateKeyName('PageUp')).toBe('PgUp')
        expect(abbreviateKeyName('LCtrl')).toBe('LCtrl')
        expect(abbreviateKeyName('LShift')).toBe('LShft')
    })

    it('returns name unchanged when no abbreviation and no maxLength', () => {
        expect(abbreviateKeyName('A')).toBe('A')
        expect(abbreviateKeyName('SomeUnknownKey')).toBe('SomeUnknownKey')
    })

    it('truncates with ellipsis when name exceeds maxLength', () => {
        expect(abbreviateKeyName('Backspace', 3)).toBe('Bk…')
        expect(abbreviateKeyName('UnknownKeyName', 5)).toBe('Unkn…')
    })

    it('does not truncate when name fits in maxLength', () => {
        expect(abbreviateKeyName('Esc', 5)).toBe('Esc')
        expect(abbreviateKeyName('Tab', 5)).toBe('Tab')
    })

    it('uses abbreviation first, then truncates if abbrev still too long', () => {
        expect(abbreviateKeyName('Left Shift', 4)).toBe('LSh…')
    })

    it('handles empty string', () => {
        expect(abbreviateKeyName('')).toBe('')
        expect(abbreviateKeyName('', 5)).toBe('')
    })

    it('handles edge maxLength values', () => {
        expect(abbreviateKeyName('Hello', 0)).toBe('')
        expect(abbreviateKeyName('Hello', 1)).toBe('…')
    })
})

describe('abbreviateLayerName', () => {
    it('returns L<index> when name is missing', () => {
        expect(abbreviateLayerName(undefined, 0)).toBe('L0')
        expect(abbreviateLayerName(null, 3)).toBe('L3')
        expect(abbreviateLayerName('', 2)).toBe('L2')
    })

    it('returns L<index> when name is whitespace only', () => {
        expect(abbreviateLayerName('   ', 1)).toBe('L1')
    })

    it('returns the trimmed name when within maxLength', () => {
        expect(abbreviateLayerName('Nav', 0)).toBe('Nav')
        expect(abbreviateLayerName('  Nav  ', 0)).toBe('Nav')
    })

    it('truncates names exceeding maxLength', () => {
        expect(abbreviateLayerName('Numbers', 0)).toBe('Numb…')
        expect(abbreviateLayerName('Symbols', 1, 4)).toBe('Sym…')
    })

    it('honors custom maxLength', () => {
        expect(abbreviateLayerName('Default', 0, 7)).toBe('Default')
        expect(abbreviateLayerName('DefaultLong', 0, 7)).toBe('Defaul…')
    })
})

describe('formatMomentaryLayer', () => {
    it('formats a layer index as MO(N)', () => {
        expect(formatMomentaryLayer(0)).toBe('MO(0)')
        expect(formatMomentaryLayer(2)).toBe('MO(2)')
        expect(formatMomentaryLayer(15)).toBe('MO(15)')
    })
})

describe('abbreviateKeyName — media', () => {
    it('keeps up/down distinguishable at cap width (knob CCW/CW pairs)', () => {
        expect(abbreviateKeyName('Volume Increment', 5)).toBe('Vol+')
        expect(abbreviateKeyName('Volume Decrement', 5)).toBe('Vol-')
        expect(abbreviateKeyName('Volume Up', 5)).toBe('Vol+')
        expect(abbreviateKeyName('Display Brightness Decrement', 5)).toBe(
            'Bri-',
        )
    })
})
