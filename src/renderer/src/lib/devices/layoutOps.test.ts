// pattern-check: skip — unit tests for the device layout edit functions.
import { describe, expect, it } from 'vitest'
import { STOCK_FLIGHTSTICK, STOCK_MOUSE } from '@firmware/devices/stockLayouts'
import type { DeviceControl, DeviceModel } from '@firmware/devices/types'
import {
    addControl,
    duplicateControl,
    mirrorControl,
    mirrorSide,
    moveControl,
    nudgeControl,
    patchControl,
    removeControl,
    rotateControl,
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

describe('selection ops', () => {
    const pad = (controls: DeviceControl[]): DeviceModel => ({
        ...mouse,
        controls,
    })
    const btn = (id: string, x: number, r?: number): DeviceControl => ({
        id,
        name: id,
        kind: 'button',
        shape: 'round',
        x,
        y: 1,
        w: 1,
        h: 1,
        ...(r ? { r } : {}),
    })

    it('rotates about the control, wrapping and dropping 0', () => {
        const m = pad([btn('a', 0, 170)])
        expect(find(rotateControl(m, 'a', 15), 'a').r).toBe(-175)
        expect(
            find(rotateControl(pad([btn('a', 0, 15)]), 'a', -15), 'a').r,
        ).toBeUndefined()
    })

    it('duplicates as a new control of the same kind', () => {
        const r = duplicateControl(pad([btn('button1', 0)]), 'button1')!
        expect(r.id).toBe('button2')
        expect(find(r.model, 'button2')).toMatchObject({
            x: 0.25,
            y: 1.25,
            name: 'button1 copy',
        })
    })

    it('mirrors across the centre line, unless on it or taken', () => {
        const m = pad([btn('button1', 0, 20), btn('mid', 2.5), btn('far', 5)])
        expect(mirrorSide(m, 'button1')).toBe('right')
        expect(mirrorSide(m, 'far')).toBe('left')
        expect(mirrorSide(m, 'mid')).toBeNull()
        expect(mirrorControl(m, 'far')).toBeNull()
        const r = mirrorControl(
            pad([btn('button1', 0, 20), btn('x', 5, 0)]),
            'button1',
        )
        expect(r).toBeNull()
        const ok = mirrorControl(
            pad(
                [btn('button1', 0, 20), btn('x', 5, 0)].map((c) =>
                    c.id === 'x' ? { ...c, y: 4 } : c,
                ),
            ),
            'button1',
        )!
        expect(find(ok.model, ok.id)).toMatchObject({ x: 5, r: -20 })
    })
})
