// pattern-check: skip — table assertions over the DOM code → HID usage map
import { describe, expect, it } from 'vitest'

import { DOM_KEY_TO_HID } from './domKeyToHidMap'

describe('DOM_KEY_TO_HID', () => {
    // L4.21: press-to-assign and the macro recorder dropped the international
    // and LANG keys, which the firmware now sends (usages up to 0xA7).
    it.each<[string, number]>([
        ['NumpadComma', 0x85],
        ['IntlRo', 0x87],
        ['KanaMode', 0x88],
        ['IntlYen', 0x89],
        ['Convert', 0x8a],
        ['NonConvert', 0x8b],
        ['Lang1', 0x90],
        ['Lang2', 0x91],
        ['Lang3', 0x92],
        ['Lang4', 0x93],
        ['Lang5', 0x94],
    ])('%s → 0x%s', (code, usage) => {
        expect(DOM_KEY_TO_HID[code]).toBe(usage)
    })

    it('maps every code to a distinct usage', () => {
        const usages = Object.values(DOM_KEY_TO_HID)
        expect(new Set(usages).size).toBe(usages.length)
    })
})
