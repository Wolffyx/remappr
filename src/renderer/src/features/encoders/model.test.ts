import { describe, expect, it } from 'vitest'
import {
    dirInfo,
    ENCODER_DIRS,
    encoderHitId,
    nextDir,
    parseEncoderHitId,
} from './model'

describe('encoder direction model', () => {
    it('lists directions left to right', () => {
        expect(ENCODER_DIRS.map((d) => d.dir)).toEqual(['ccw', 'cw'])
        expect(ENCODER_DIRS.map((d) => d.side)).toEqual(['left', 'right'])
    })

    it('maps directions to the EncoderApi wire flag (0 = clockwise)', () => {
        expect(dirInfo('cw').wire).toBe(0)
        expect(dirInfo('ccw').wire).toBe(1)
    })

    it('advances counter-clockwise to clockwise, then stops', () => {
        expect(nextDir('ccw')).toBe('cw')
        expect(nextDir('cw')).toBeNull()
    })

    it('round-trips the stage hit id', () => {
        for (const { dir } of ENCODER_DIRS) {
            const sel = { slot: 3, dir }
            expect(parseEncoderHitId(encoderHitId(sel))).toEqual(sel)
        }
    })

    it('rejects malformed hit ids', () => {
        for (const bad of ['', '3', 'x:cw', '-1:cw', '1.5:cw', '2:up']) {
            expect(parseEncoderHitId(bad)).toBeNull()
        }
    })
})
