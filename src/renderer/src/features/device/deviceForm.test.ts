// pattern-check: skip — table-free unit tests of the pure form converters
import { describe, expect, it } from 'vitest'
import type { ConfigDevice, ConfigMouse } from '@firmware/config'

import {
    dongleDraft,
    dongleFromDraft,
    mouseDraft,
    mouseFromDraft,
    radioDraft,
    radioFromDraft,
    withSections,
} from './deviceForm'

describe('dongle draft', () => {
    it('round-trips the stored settings', () => {
        const stored = { nkro: false, pairWindowMs: 60000, failsafeMs: 150 }
        const draft = dongleDraft(stored)
        expect(draft.nkro).toBe('boot')
        expect(draft.numbers.pairWindowMs).toBe('60000')
        expect(draft.numbers.rosterLiveMs).toBe('')
        expect(dongleFromDraft(draft)).toEqual({ dongle: stored, errors: {} })
    })

    it('leaves out NKRO on "keep" and an empty field', () => {
        const draft = dongleDraft(undefined)
        expect(draft.nkro).toBe('keep')
        expect(dongleFromDraft(draft)).toEqual({
            dongle: undefined,
            errors: {},
        })
    })

    it('flags out-of-range and non-numeric input', () => {
        const draft = dongleDraft(undefined)
        draft.numbers.failsafeMs = '10'
        draft.numbers.pairWindowMs = '1.5'
        const { errors } = dongleFromDraft(draft)
        expect(errors.failsafeMs).toBe('50–2000')
        expect(errors.pairWindowMs).toBe('Whole number')
    })

    it('keeps the offline horizon at or above the failsafe', () => {
        const draft = dongleDraft({ failsafeMs: 500 })
        draft.numbers.rosterLiveMs = '400'
        expect(dongleFromDraft(draft).errors.rosterLiveMs).toMatch(/500 ms/)
        // Against the default failsafe (100 ms) when it is left out.
        const d2 = dongleDraft(undefined)
        d2.numbers.rosterLiveMs = '100'
        expect(dongleFromDraft(d2).errors).toEqual({})
    })
})

describe('radio draft', () => {
    it('writes auto-pair only when it was set or turned off', () => {
        expect(radioFromDraft(radioDraft(undefined), undefined).radio).toBe(
            undefined,
        )
        const off = radioDraft(undefined)
        off.autoPair = false
        expect(radioFromDraft(off, undefined).radio).toEqual({
            autoPair: false,
        })
        const kept = radioDraft({ autoPair: true, keepaliveMs: 60 })
        expect(
            radioFromDraft(kept, { autoPair: true, keepaliveMs: 60 }),
        ).toEqual({
            radio: { autoPair: true, keepaliveMs: 60 },
            errors: {},
        })
    })
})

describe('mouse draft', () => {
    const range = { min: 100, max: 3200 }
    const stored: ConfigMouse = {
        cpi: 1600,
        autoLayerTimeoutMs: 300,
        accel: [
            [10, 150],
            [0, 100],
        ],
        invertWheel: true,
        scrollDivisor: 2,
        buttonMap: [1, 0, 2, 3, null, 5, 6, 7],
    }

    it('round-trips a stored section, sorting the curve', () => {
        const { mouse, errors } = mouseFromDraft(
            mouseDraft(stored),
            stored,
            range,
        )
        expect(errors).toEqual({})
        expect(mouse).toEqual({
            ...stored,
            accel: [
                [0, 100],
                [10, 150],
            ],
        })
    })

    it('is empty for the defaults', () => {
        const { mouse } = mouseFromDraft(
            mouseDraft(undefined),
            undefined,
            range,
        )
        expect(mouse).toBeUndefined()
    })

    it('drops a field the user cleared and keeps unedited ones', () => {
        const draft = mouseDraft(stored)
        draft.cpi = ''
        draft.curve = []
        draft.flags.invertWheel = false
        const { mouse } = mouseFromDraft(draft, stored, range)
        expect(mouse?.cpi).toBeUndefined()
        expect(mouse?.accel).toBeUndefined()
        expect(mouse?.invertWheel).toBe(false)
        expect(mouse?.autoLayerTimeoutMs).toBe(300)
    })

    it('checks DPI against the sensor range and the curve points', () => {
        const draft = mouseDraft(undefined)
        draft.cpi = '50'
        draft.curve = [
            { speed: '5', percent: '120' },
            { speed: '5', percent: '140' },
        ]
        const { errors } = mouseFromDraft(draft, undefined, range)
        expect(errors.cpi).toBe('100–3200')
        expect(errors.curve).toMatch(/share a speed/)
    })

    it('edits the starting DPI stage when the mouse has stages', () => {
        const stored = {
            dpiStages: [400, 800, 1600],
            dpiStage: 1,
            invertY: true,
        }
        const draft = mouseDraft(stored)
        expect(draft.cpi).toBe('800')
        const { mouse } = mouseFromDraft(
            { ...draft, cpi: '1000' },
            stored,
            null,
        )
        expect(mouse).toMatchObject({
            dpiStages: [400, 1000, 1600],
            dpiStage: 1,
        })
        expect(mouse?.cpi).toBeUndefined()
        const cleared = mouseFromDraft({ ...draft, cpi: '' }, stored, null)
        expect(cleared.mouse?.dpiStages).toEqual([400, 800, 1600])
    })

    it('maps "off" to a dropped button', () => {
        const draft = mouseDraft(undefined)
        draft.buttons[1] = 'off'
        expect(
            mouseFromDraft(draft, undefined, range).mouse?.buttonMap,
        ).toEqual([0, null, 2, 3, 4, 5, 6, 7])
    })
})

describe('withSections', () => {
    it('replaces the device sections and keeps the header', () => {
        const base: ConfigDevice = {
            schemaVersion: 1,
            kind: 'remappr.device',
            meta: { name: 'Mouse' },
            personality: 'mouse',
            mouse: { cpi: 800 },
            radio: { keepaliveMs: 60 },
        }
        expect(withSections(base, { mouse: { cpi: 1600 } })).toEqual({
            schemaVersion: 1,
            kind: 'remappr.device',
            meta: { name: 'Mouse' },
            personality: 'mouse',
            mouse: { cpi: 1600 },
        })
    })
})
