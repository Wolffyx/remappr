// pattern-check: skip vitest cases over the battery display helpers
import { afterEach, describe, expect, it } from 'vitest'
import {
    batteryLook,
    batteryText,
    resetLowWarnings,
    shouldWarnLow,
    shownBattery,
    type ShownBattery,
} from './battery'

afterEach(resetLowWarnings)

describe('battery display', () => {
    it('marks low with the device threshold, else the firmware default', () => {
        expect(shownBattery({ level: 20, charging: false }, 25).low).toBe(true)
        expect(shownBattery({ level: 20, charging: false }).low).toBe(false)
        expect(shownBattery({ level: 15, charging: false }).low).toBe(true)
        expect(shownBattery({ level: 5, charging: true }).low).toBe(false)
    })

    it('picks an icon and text by charge', () => {
        const b = (level: number, charging = false): ShownBattery =>
            shownBattery({ level, charging })
        expect(
            [b(5), b(30), b(60), b(90), b(5, true)].map(batteryLook),
        ).toEqual(['low', 'third', 'half', 'full', 'charging'])
        expect([b(5), b(73), b(40, true)].map(batteryText)).toEqual([
            '5% · low',
            '73%',
            '40% · charging',
        ])
    })

    it('warns once per low spell, again after a charge', () => {
        const low = shownBattery({ level: 9, charging: false })
        const ok = shownBattery({ level: 80, charging: false })
        expect(shouldWarnLow('m', low)).toBe(true)
        expect(shouldWarnLow('m', low)).toBe(false)
        expect(shouldWarnLow('k', low)).toBe(true)
        expect(shouldWarnLow('m', ok)).toBe(false)
        expect(shouldWarnLow('m', low)).toBe(true)
        expect(shouldWarnLow('m', undefined)).toBe(false)
    })
})
