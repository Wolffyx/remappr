// Pattern check: no GoF pattern (-) — rejected — unit tests for the pure usage→icon lookup.
import { describe, expect, it } from 'vitest'
import { hidUsageIcon, legendIcon } from './legendIcons'

const consumer = (id: number): number => (0x0c << 16) | id
const keyboard = (id: number): number => (0x07 << 16) | id

describe('hidUsageIcon', () => {
    it('names media usages on the consumer page', () => {
        expect(hidUsageIcon(consumer(0xe9))).toBe('volume-up')
        expect(hidUsageIcon(consumer(0xea))).toBe('volume-down')
        expect(hidUsageIcon(consumer(0xe2))).toBe('mute')
        expect(hidUsageIcon(consumer(0xcd))).toBe('play')
        expect(hidUsageIcon(consumer(0xb5))).toBe('next')
        expect(hidUsageIcon(consumer(0x6f))).toBe('brightness-up')
    })

    it('names the keyboard-page volume keys', () => {
        expect(hidUsageIcon(keyboard(0x80))).toBe('volume-up')
        expect(hidUsageIcon(keyboard(0x81))).toBe('volume-down')
    })

    it('leaves ordinary and chorded usages as text', () => {
        expect(hidUsageIcon(keyboard(0x04))).toBeUndefined() // A
        expect(hidUsageIcon((0x01 << 24) | keyboard(0x80))).toBeUndefined()
        expect(hidUsageIcon(undefined)).toBeUndefined()
    })

    it('every id it returns resolves to an icon', () => {
        for (const id of [0xe9, 0xea, 0xe2, 0xcd, 0xb5, 0xb6, 0x6f, 0x70]) {
            expect(legendIcon(hidUsageIcon(consumer(id)))).toBeDefined()
        }
    })
})
