// Pattern check: no GoF pattern (-) — rejected — unit tests for the paint store actions, no abstraction.
import { describe, it, expect, beforeEach } from 'vitest'

import usePerKeyPaintStore from './perKeyPaintStore'

const s = (): ReturnType<typeof usePerKeyPaintStore.getState> =>
    usePerKeyPaintStore.getState()

describe('perKeyPaintStore', () => {
    beforeEach(() => {
        s().setActive(false)
        s().reset()
    })

    it('paints the current brush onto a key (canvas-idx keyed)', () => {
        s().setBrush({ h: 100, s: 200, v: 255 })
        s().paint(3)
        expect(s().colors[3]).toEqual({ h: 100, s: 200, v: 255 })
    })

    it('fillAll paints every given index', () => {
        s().setBrush({ h: 50, s: 60, v: 70 })
        s().fillAll([0, 1, 2])
        expect(s().colors[0]).toEqual({ h: 50, s: 60, v: 70 })
        expect(s().colors[2]).toEqual({ h: 50, s: 60, v: 70 })
    })

    it('load seeds device colours and reset clears them', () => {
        s().load({ 5: { h: 1, s: 2, v: 3 } })
        expect(s().colors[5]).toEqual({ h: 1, s: 2, v: 3 })
        s().reset()
        expect(s().colors).toEqual({})
    })

    it('painted colours are copies, not brush references', () => {
        const brush = { h: 9, s: 9, v: 9 }
        s().setBrush(brush)
        s().paint(0)
        s().setBrush({ h: 1, s: 1, v: 1 })
        expect(s().colors[0]).toEqual({ h: 9, s: 9, v: 9 })
    })
})
