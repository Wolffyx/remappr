import { describe, expect, it } from 'vitest'
import seed from '@firmware/clients/mock/seed.keymap.json?raw'
import { buildCheck } from './readiness'

const demo = { kind: 'remappr.keymap' as const, source: seed }

describe('buildCheck', () => {
    it('names what stops the demo keymap from building, per target', () => {
        expect(buildCheck(demo, 'zmk')).toEqual({
            blockers: ['Set a controller board (e.g. nice_nano_v2).'],
            ciBuild: true,
        })
        expect(buildCheck(demo, 'qmk')?.blockers).toContain(
            'Set a USB vendor + product id.',
        )
    })

    it('knows which targets build on GitHub', () => {
        expect(buildCheck(demo, 'qmk')?.ciBuild).toBe(true)
        expect(buildCheck(demo, 'remappr')?.ciBuild).toBe(false)
    })

    it('has nothing to say without firmware files', () => {
        expect(buildCheck(demo, null)).toBeNull()
        expect(
            buildCheck({ kind: 'remappr.device', source: '{}' }, 'zmk'),
        ).toBeNull()
        expect(
            buildCheck({ kind: 'remappr.keymap', source: '{ broken' }, 'zmk'),
        ).toBeNull()
    })
})
