// pattern-check: skip — unit tests for the device stage geometry and callouts.
import { describe, expect, it } from 'vitest'
import { defaultLayout } from '@firmware/devices/defaultLayout'
import {
    STOCK_FLIGHTSTICK,
    STOCK_GAMEPAD,
    STOCK_MOUSE,
} from '@firmware/devices/stockLayouts'
import type { DeviceModel } from '@firmware/devices/types'
import {
    calloutAnchors,
    CALLOUT_H,
    layoutCallouts,
    stackCallouts,
} from './callouts'
import {
    CALL_GAP,
    CALL_M,
    CALL_W,
    computeLayout,
    computeShell,
    controlRadius,
    DEV_S,
} from './geometry'

const model = (
    m: Pick<DeviceModel, 'shell' | 'controls'>,
    form: DeviceModel['form'] = 'mouse',
): DeviceModel => ({ kind: 'mouse', form, name: 'T', ...m })

describe('computeShell', () => {
    it('fits one mouse body over the buttons plus the palm rest', () => {
        const parts = computeShell(model(STOCK_MOUSE))
        expect(parts).toHaveLength(1)
        // side buttons are on the edge, so the body starts at the left button
        expect(parts[0]!.x).toBeCloseTo(-0.2)
        expect(parts[0]!.h).toBeGreaterThan(9)
    })

    it('gives a gamepad a body and two mirrored grips', () => {
        const parts = computeShell(model(STOCK_GAMEPAD, 'gamepad'))
        expect(parts).toHaveLength(3)
        expect(parts[0]!.rot).toBe(16)
        expect(parts[1]!.rot).toBe(-16)
    })

    it('builds a flight stick from base, shaft and grip', () => {
        const parts = computeShell(model(STOCK_FLIGHTSTICK, 'flightstick'))
        expect(parts.map((p) => p.tone ?? 'light')).toEqual([
            'light',
            'dark',
            'light',
        ])
    })

    it('gives each plate zone its own slab', () => {
        const kb = defaultLayout('keyboard', 'K', { rows: 2, cols: 2 })
        const split = {
            ...kb,
            controls: kb.controls.map((c, i) => ({
                ...c,
                zone: i % 2 ? 'right' : 'left',
            })),
        }
        expect(computeShell(kb)).toHaveLength(1)
        expect(computeShell(split)).toHaveLength(2)
    })

    it('fits nothing around a device without controls', () => {
        expect(computeShell(model({ ...STOCK_MOUSE, controls: [] }))).toEqual(
            [],
        )
    })
})

describe('computeLayout', () => {
    it('reserves a callout gutter on each side that has callouts', () => {
        const m = model(STOCK_MOUSE)
        const L = computeLayout(m)
        const full = CALL_M + CALL_W + CALL_GAP
        expect(L.ox).toBeGreaterThanOrEqual(full - 1 * DEV_S)
        expect(L.side(STOCK_MOUSE.controls[2]!)).toBe('R') // wheel, label R
        expect(L.side(STOCK_MOUSE.controls[4]!)).toBe('L') // left side button
    })

    it('drops the gutters when compact', () => {
        const m = model(STOCK_MOUSE)
        expect(computeLayout(m, { compact: true }).W).toBeLessThan(
            computeLayout(m).W,
        )
    })

    it('keeps a frozen frame while dragging', () => {
        const frozen = { W: 1, H: 2, ox: 3, oy: 4 }
        expect(computeLayout(model(STOCK_MOUSE), { frozen })).toMatchObject(
            frozen,
        )
    })

    it('puts keys on no side list (keys are labelled on the cap)', () => {
        const kb = defaultLayout('keyboard', 'K', { rows: 1, cols: 3 })
        expect(calloutAnchors(kb, computeLayout(kb))).toEqual([])
    })
})

describe('callouts', () => {
    it('keeps cards at least 60px apart on a side', () => {
        const ys = stackCallouts(
            [
                { id: 'a', ay: 100 },
                { id: 'b', ay: 105 },
                { id: 'c', ay: 110 },
            ],
            1000,
        )
        expect(ys.b! - ys.a!).toBeGreaterThanOrEqual(60)
        expect(ys.c! - ys.b!).toBeGreaterThanOrEqual(60)
        expect(ys.a).toBe(100 - CALLOUT_H / 2)
    })

    it('pulls a stack that overflows back inside the canvas', () => {
        const ys = stackCallouts(
            [
                { id: 'a', ay: 180 },
                { id: 'b', ay: 190 },
            ],
            200,
        )
        expect(ys.b! + CALLOUT_H).toBeLessThanOrEqual(200 - 12)
        expect(ys.b! - ys.a!).toBeGreaterThanOrEqual(60)
    })

    it('lays out both sides independently', () => {
        const m = model(STOCK_MOUSE)
        const L = computeLayout(m)
        const ys = layoutCallouts(calloutAnchors(m, L), L.H)
        expect(Object.keys(ys).sort()).toEqual(
            ['back', 'dpi', 'fwd', 'lmb', 'rmb', 'sensor', 'wheel'].sort(),
        )
    })
})

describe('controlRadius', () => {
    it('rounds round shapes fully and keys slightly', () => {
        expect(controlRadius('stick', 40, 40)).toBe('999px')
        expect(controlRadius('pill', 20, 40)).toBe('10px')
        expect(controlRadius('key', 50, 50)).toBe('8px')
    })
})
