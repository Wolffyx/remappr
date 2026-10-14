// pattern-check: skip — unit tests for the device display helpers.
import { beforeAll, describe, expect, it } from 'vitest'
import { connectDemoDevice } from '@firmware/clients/mock/devices/demoDevices'
import type {
    ControlsCatalog,
    DeviceBindings,
    DeviceControl,
    DeviceModel,
} from '@firmware/devices/types'
import {
    bindingSummary,
    indexCatalog,
    type CatalogIndex,
} from './bindingSummary'
import { curveAt, curveSamples } from './curves'
import { categoryAccent, controlColors, profileAccent } from './deviceCategory'
import { deviceSummary } from './labels'
import { supportsField, visibleSections } from './sections'

let catalog: ControlsCatalog
let ix: CatalogIndex
let mouse: DeviceModel
let mouseBindings: DeviceBindings
let pad: DeviceModel
let padBindings: DeviceBindings

beforeAll(async () => {
    const m = await connectDemoDevice('halo-m2')
    catalog = await m.controls!.getCatalog()
    ix = indexCatalog(catalog)
    mouse = await m.controls!.getModel()
    mouseBindings = await m.controls!.getBindings('p0')
    const p = await connectDemoDevice('vector-pad')
    pad = await p.controls!.getModel()
    padBindings = await p.controls!.getBindings('p0')
})

const control = (m: DeviceModel, id: string): DeviceControl =>
    m.controls.find((c) => c.id === id)!

describe('bindingSummary', () => {
    it('reads a button with a hold action', () => {
        expect(
            bindingSummary(control(mouse, 'back'), mouseBindings, ix),
        ).toEqual({
            text: 'Back',
            sub: 'hold · Sniper (hold)',
            cat: 'mouse',
        })
    })

    it('reads the wheel, sensor, stick, trigger and d-pad', () => {
        expect(
            bindingSummary(control(mouse, 'wheel'), mouseBindings, ix),
        ).toMatchObject({
            text: 'Scroll · 3 lines',
            sub: 'click · Middle click',
        })
        expect(
            bindingSummary(control(mouse, 'sensor'), mouseBindings, ix),
        ).toMatchObject({
            text: '1600 DPI',
            sub: '1000 Hz',
        })
        expect(bindingSummary(control(pad, 'rs'), padBindings, ix)).toEqual({
            text: 'Right stick',
            sub: 'Aggressive · dz 6%',
            cat: 'pad',
        })
        expect(
            bindingSummary(control(pad, 'rt'), padBindings, ix),
        ).toMatchObject({
            sub: 'Hair trigger · 4–70%',
        })
        expect(
            bindingSummary(control(pad, 'dpad'), padBindings, ix),
        ).toMatchObject({
            text: '4-way · D-pad ↑',
            cat: 'pad',
        })
    })

    it('reads an unbound control as its kind default', () => {
        expect(bindingSummary(control(pad, 'lb'), {}, ix)).toEqual({
            text: 'Disabled',
            sub: undefined,
            cat: 'none',
        })
    })
})

describe('curves', () => {
    it('honours the deadzone and saturation point', () => {
        expect(curveAt('linear', 0.05, 8)).toBe(0)
        expect(curveAt('linear', 0.97, 0, 95)).toBe(1)
        expect(curveAt('linear', 0.5)).toBeCloseTo(0.5)
    })

    it('bends above or below linear by curve', () => {
        expect(curveAt('aggressive', 0.25)).toBeGreaterThan(0.25)
        expect(curveAt('relaxed', 0.25)).toBeLessThan(0.25)
    })

    it('samples from 0 to 1', () => {
        const pts = curveSamples('precise', 0, 100, 10)
        expect(pts).toHaveLength(11)
        expect(pts[0]).toEqual([0, 0])
        expect(pts[10]).toEqual([1, 1])
    })
})

describe('sections', () => {
    it('shows only sections whose fields the adapter honours', () => {
        // the demo mouse honours tap + hold only (no turbo / toggle)
        expect(visibleSections('button', catalog.fields)).toEqual([
            'tap',
            'hold',
        ])
        expect(visibleSections('button', { button: ['a'] })).toEqual(['tap'])
        expect(visibleSections('sensor', {})).toEqual([])
        expect(supportsField({ stick: ['out'] }, 'stick', 'curve')).toBe(false)
    })
})

describe('colours and labels', () => {
    it('keeps neutral categories and mono mode untinted', () => {
        expect(categoryAccent('key')).toBe('var(--muted-foreground)')
        expect(controlColors('mouse', true)).toEqual(controlColors('none'))
        expect(controlColors('mouse').glow).toContain('42')
    })

    it('cycles profile accents and summarises a device', () => {
        expect(profileAccent(0)).toBe(profileAccent(7))
        expect(deviceSummary('mouse', 7)).toBe('Mouse · 7 controls')
    })
})
