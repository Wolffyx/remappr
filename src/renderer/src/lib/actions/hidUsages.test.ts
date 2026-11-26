// pattern-check: skip — unit test for the Button-page label fallback
import { describe, expect, it } from 'vitest'

import { hidUsageLongLabel, usageGlyph } from './hidUsages'

describe('HID usage labels', () => {
    it('names mouse buttons (Button page) like the key catalog', () => {
        const button1 = (0x09 << 16) | 1
        expect(hidUsageLongLabel(button1)).toBe('Mouse button 1')
        expect(usageGlyph(button1, 8)).not.toBe('')
    })

    it('still names keyboard keys from the usage tables', () => {
        expect(hidUsageLongLabel((0x07 << 16) | 0x06)).toBe('C')
    })
})
