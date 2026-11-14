// pattern-check: skip — assertions over the Scanning dialog's part selection and diff
import { describe, expect, it } from 'vitest'
import type { SensorInfo, SensorSettingInfo } from '@firmware/devices/types'

import type { KeyboardService } from '@firmware/service'
import { FEATURE_PROBES } from './useFeatureAvailable'
import {
    changedSettings,
    matrixParts,
    settingsInForce,
} from './scanningSettings'

const setting = (over: Partial<SensorSettingInfo>): SensorSettingInfo => ({
    name: 'scanPeriodMs',
    label: 'Scan period',
    type: 'int',
    unit: 'ms',
    min: 1,
    max: 10,
    step: 1,
    advanced: true,
    default: 1,
    value: 1,
    personality: false,
    ...over,
})

const part = (over: Partial<SensorInfo>): SensorInfo => ({
    index: 1,
    cls: 'matrix',
    model: 'kbd_matrix',
    channels: 1,
    io: [],
    settings: [],
    procedures: [],
    metrics: [],
    ...over,
})

// L4.20: a keyboard's matrix settings (0x30–0x34, eager press among them)
// had no panel at all.
describe('matrixParts', () => {
    it('keeps the key-matrix parts and their settable settings', () => {
        const parts = [
            part({ index: 0, cls: 'battery' as SensorInfo['cls'] }),
            part({
                index: 1,
                settings: [
                    setting({}),
                    setting({
                        name: 'eagerPress',
                        type: 'bool',
                        default: true,
                        value: true,
                    }),
                    setting({ name: 'pollRate', personality: true }),
                ],
            }),
        ]
        const found = matrixParts(parts)
        expect(found.map((p) => p.index)).toEqual([1])
        expect(found[0].settings.map((s) => s.name)).toEqual([
            'scanPeriodMs',
            'eagerPress',
        ])
    })

    it('leaves out a matrix that describes no settings', () => {
        expect(matrixParts([part({ settings: [] })])).toEqual([])
    })
})

describe('settingsInForce / changedSettings', () => {
    const parts = [
        part({
            index: 2,
            settings: [
                setting({ name: 'scanPeriodMs', default: 1, value: 3 }),
                setting({
                    name: 'eagerPress',
                    type: 'bool',
                    default: true,
                    value: true,
                }),
            ],
        }),
    ]

    it('holds only the values off their default', () => {
        expect(settingsInForce(parts)).toEqual({ 2: { scanPeriodMs: 3 } })
    })

    it('sends nothing when nothing changed', () => {
        expect(changedSettings(parts, settingsInForce(parts))).toEqual([])
    })

    it('sends a changed value and a reset to default', () => {
        const values = { 2: { eagerPress: false } } // scanPeriodMs reset
        expect(changedSettings(parts, values)).toEqual([
            { part: 2, name: 'scanPeriodMs', value: 1 },
            { part: 2, name: 'eagerPress', value: false },
        ])
    })
})

describe('scanning feature gate', () => {
    const svc = (over: object): KeyboardService =>
        ({ capabilities: {}, ...over }) as unknown as KeyboardService

    it('opens for a keyboard that describes its parts', () => {
        expect(
            !!FEATURE_PROBES.scanning(svc({ kind: 'keyboard', sensor: {} })),
        ).toBe(true)
    })

    it('stays shut without the PART namespace, and on a mouse', () => {
        expect(!!FEATURE_PROBES.scanning(svc({ kind: 'keyboard' }))).toBe(false)
        expect(
            !!FEATURE_PROBES.scanning(svc({ kind: 'mouse', sensor: {} })),
        ).toBe(false)
    })
})
