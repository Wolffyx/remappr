// Pattern check: no GoF pattern (-) — rejected — unit tests for the pure
// slot→dropdown-config lookup; test code, no design pattern.
import { describe, expect, it } from 'vitest'
import type { ActionSlot } from '@firmware/types'
import { selectConfigForSlot } from './selectConfigForSlot'

const layers = [
    { id: 0, name: 'Base' },
    { id: 1, name: 'Fn' },
]

describe('selectConfigForSlot', () => {
    it('maps a layer slot to id/name options with a label', () => {
        const cfg = selectConfigForSlot(
            { label: 'Layer', kind: 'layer' },
            layers,
        )
        expect(cfg?.options).toEqual([
            { value: 0, label: 'Base' },
            { value: 1, label: 'Fn' },
        ])
        expect(cfg?.label).toBe('Layer')
    })

    it('maps an enum slot to its values and shows no leading label', () => {
        const slot: ActionSlot = {
            label: 'Command',
            kind: 'enum',
            values: [{ value: 3, label: 'BT_SEL' }],
        }
        const cfg = selectConfigForSlot(slot, layers)
        expect(cfg?.options).toEqual([{ value: 3, label: 'BT_SEL' }])
        expect(cfg?.label).toBeUndefined()
    })

    it('numbers a small range from range.min (0-based by default)', () => {
        const slot: ActionSlot = {
            label: 'profile',
            kind: 'number',
            range: { min: 0, max: 4 },
        }
        const cfg = selectConfigForSlot(slot, layers)
        expect(cfg?.options).toEqual([
            { value: 0, label: 0 },
            { value: 1, label: 1 },
            { value: 2, label: 2 },
            { value: 3, label: 3 },
            { value: 4, label: 4 },
        ])
    })

    it('labels a one-based range from 1 while keeping the raw value', () => {
        const slot: ActionSlot = {
            label: 'profile',
            kind: 'number',
            range: { min: 0, max: 4 },
            oneBased: true,
        }
        const cfg = selectConfigForSlot(slot, layers)
        // value = stored 0-based index; label = user-facing 1-based number.
        expect(cfg?.options).toEqual([
            { value: 0, label: 1 },
            { value: 1, label: 2 },
            { value: 2, label: 3 },
            { value: 3, label: 4 },
            { value: 4, label: 5 },
        ])
    })

    it('returns null for a wide range (free input) and non-list slots', () => {
        expect(
            selectConfigForSlot(
                { label: 'n', kind: 'number', range: { min: 0, max: 255 } },
                layers,
            ),
        ).toBeNull()
        expect(
            selectConfigForSlot({ label: 'k', kind: 'hid' }, layers),
        ).toBeNull()
        expect(
            selectConfigForSlot({ label: 'a', kind: 'action' }, layers),
        ).toBeNull()
    })
})
