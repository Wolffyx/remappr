// pattern-check: skip — unit test, no production logic
import { describe, expect, it } from 'vitest'
import { act, DEMO_CATALOG } from '@firmware/clients/mock/devices/catalog'
import type { ControlsCatalog } from '@firmware/devices/types'
import { devicePicker, KEYS_TYPE, NONE_TYPE } from './devicePicker'

const demo = devicePicker(DEMO_CATALOG)
const roundTrip = (id: string | null): string | null | undefined =>
    demo.fromDraft(demo.toKeyAction(id))

describe('devicePicker', () => {
    it('shows the catalog as behaviors: groups in order, keys as Key press, Disabled last', () => {
        expect(demo.actionTypes.map((t) => t.displayName)).toEqual([
            'Mouse',
            'Key press',
            'Keyboard', // the shortcuts, which have no single usage
            'Media', // Mic mute
            'Gamepad',
            'System',
            'Macro',
            'Profile / layer',
            'Disabled',
        ])
        const keys = demo.actionTypes.find((t) => t.id === KEYS_TYPE)!
        expect(keys.slots).toEqual([{ label: 'Key', kind: 'hid' }])
        const mouse = demo.actionTypes[0]!
        expect(mouse.slots[0]!.kind).toBe('enum')
        expect(mouse.slots[0]!.values?.[0]?.label).toBe('Left click')
    })

    it('maps a key to the grid by its usage and back', () => {
        const q = demo.toKeyAction(act('key', 'Q'))
        expect(q.kind).toBe(KEYS_TYPE)
        expect(q.params).toEqual([(7 << 16) | 0x14])
        expect(q.label.primary).toBe('Q')
        expect(roundTrip(act('key', 'Q'))).toBe(act('key', 'Q'))
        expect(roundTrip(act('media', 'Mute'))).toBe(act('media', 'Mute'))
    })

    it('maps a list action to its group and index and back', () => {
        const back = demo.toKeyAction(act('mouse', 'Back'))
        expect(back.kind).toBe('device:group:mouse')
        expect(back.params).toEqual([3])
        for (const id of [
            act('mouse', 'Back'),
            act('key', 'Ctrl + C'),
            act('pad', 'A'),
            act('profile', 'Lower'),
        ]) {
            expect(roundTrip(id), id).toBe(id)
        }
    })

    it('maps Disabled to no action', () => {
        expect(demo.toKeyAction(null).kind).toBe(NONE_TYPE)
        expect(demo.fromDraft({ kind: NONE_TYPE, params: [] })).toBeNull()
    })

    it('limits the keycode grid to the keys the device sends', () => {
        expect(demo.codec.supports('key.keyboard_q')).toBe(true)
        expect(demo.codec.supports('key.keyboard_1')).toBe(false)
        const ids = demo.catalog.pages.flatMap((p) =>
            p.entries.map((e) => e.id),
        )
        expect(ids).toContain('key.keyboard_q')
        expect(ids).toContain('media.mute')
        expect(ids).not.toContain('key.keyboard_1')
    })

    it('ignores a choice that is not one of the device actions', () => {
        expect(
            demo.fromDraft({ kind: KEYS_TYPE, params: [(7 << 16) | 0x1e] }),
        ).toBeUndefined()
        expect(demo.fromDraft({ kind: 'zmk:kp', params: [4] })).toBeUndefined()
        expect(demo.toKeyAction('nope').kind).toBe('')
    })

    it('has no Key press for a device without keys', () => {
        const catalog: ControlsCatalog = {
            groups: [
                { id: 'mouse', label: 'Mouse', category: 'mouse' },
                { id: 'dpi', label: 'DPI', category: 'mouse' },
            ],
            actions: [
                {
                    id: 'lmb',
                    label: 'Left click',
                    group: 'mouse',
                    category: 'mouse',
                },
                {
                    id: 'dpi+',
                    label: 'DPI up',
                    group: 'dpi',
                    category: 'mouse',
                },
            ],
            outputs: {},
            fields: {},
        }
        const p = devicePicker(catalog)
        expect(p.actionTypes.map((t) => t.id)).toEqual([
            'device:group:mouse',
            'device:group:dpi',
            NONE_TYPE,
        ])
        expect(p.catalog.pages).toEqual([])
    })
})
