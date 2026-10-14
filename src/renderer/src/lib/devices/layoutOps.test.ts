// pattern-check: skip — unit tests for the device layout edit functions.
import { describe, expect, it } from 'vitest'
import { STOCK_FLIGHTSTICK, STOCK_MOUSE } from '@firmware/devices/stockLayouts'
import type { DeviceControl, DeviceModel } from '@firmware/devices/types'
import {
    addControl,
    moveControl,
    nudgeControl,
    patchControl,
    removeControl,
    setShell,
    snapU,
} from './layoutOps'

const mouse: DeviceModel = {
    kind: 'mouse',
    form: 'mouse',
    name: 'M',
    ...STOCK_MOUSE,
}
const stick: DeviceModel = {
    kind: 'joystick',
    form: 'flightstick',
    name: 'S',
    ...STOCK_FLIGHTSTICK,
}
const find = (m: DeviceModel, id: string): DeviceControl =>
    m.controls.find((c) => c.id === id)!

describe('layout ops', () => {
    it('snaps to the quarter-unit grid unless free', () => {
        expect(snapU(1.13)).toBe(1.25)
        expect(snapU(1.13, true)).toBe(1.13)
    })

    it('moves and nudges without touching other controls', () => {
        const m = moveControl(mouse, 'dpi', 3, 3.333)
        expect(find(m, 'dpi')).toMatchObject({ x: 3, y: 3.33 })
        expect(find(m, 'lmb')).toBe(find(mouse, 'lmb'))
        expect(find(nudgeControl(m, 'dpi', -0.25, 0), 'dpi').x).toBe(2.75)
    })

    it('patches fields and removes the ones set to undefined', () => {
        const m = patchControl(mouse, 'wheel', {
            name: 'Wheel',
            label: undefined,
        })
        expect(find(m, 'wheel').name).toBe('Wheel')
        expect('label' in find(m, 'wheel')).toBe(false)
    })

    it('adds a control of a kind with a fresh id, in the middle', () => {
        const a = addControl(mouse, 'button')
        expect(a.id).toBe('button1')
        expect(find(a.model, 'button1')).toMatchObject({
            kind: 'button',
            shape: 'round',
        })
        const b = addControl(a.model, 'button')
        expect(b.id).toBe('button2')
        expect(find(addControl(stick, 'hat').model, 'hat1').zone).toBe('head')
    })

    it('removes a control and changes shell parameters', () => {
        expect(removeControl(mouse, 'dpi').controls).toHaveLength(6)
        expect(setShell(mouse, { tail: 2 }).shell).toEqual({
            type: 'mouse',
            pad: 0.2,
            tail: 2,
        })
    })
})
