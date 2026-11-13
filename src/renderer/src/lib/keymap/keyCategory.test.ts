// pattern-check: skip — table-driven assertions over the category mapper
import { describe, expect, it } from 'vitest'
import { hidUsageFromPageAndId } from '@/lib/actions/hidUsages'
import {
    categoryForBinding,
    categoryForUsage,
    catStyle,
    type KeyCategory,
} from './keyCategory'

const KEYBOARD = 0x07
const CONSUMER = 0x0c
const u = (id: number, page = KEYBOARD): number =>
    hidUsageFromPageAndId(page, id)

describe('categoryForUsage', () => {
    it.each<[string, number, KeyCategory]>([
        ['letter Q', u(0x14), 'alpha'],
        ['digit 1', u(0x1e), 'num'],
        ['Enter', u(0x28), 'edit'],
        ['Escape', u(0x29), 'system'],
        ['Space', u(0x2c), 'space'],
        ['minus', u(0x2d), 'punct'],
        ['F5', u(0x3e), 'system'],
        ['Right arrow', u(0x4f), 'nav'],
        ['Home', u(0x4a), 'nav'],
        ['Left Ctrl', u(0xe0), 'mod'],
        ['Volume Up (consumer)', u(0xe9, CONSUMER), 'media'],
    ])('%s → %s', (_label, usage, expected) => {
        expect(categoryForUsage(usage)).toBe(expected)
    })

    it('defaults to alpha for an undefined usage', () => {
        expect(categoryForUsage(undefined)).toBe('alpha')
    })
})

describe('categoryForBinding', () => {
    it('marks &trans / out-of-range as pass-thru', () => {
        expect(categoryForBinding({ actionLabel: '&trans' })).toBe('trans')
        expect(categoryForBinding({ outOfRange: true })).toBe('trans')
    })

    it('reads a mod-tap as a modifier (hold dominates)', () => {
        expect(
            categoryForBinding({
                actionLabel: '&mt',
                bindingParam1: u(0x04), // tap = A
                isHoldTap: true,
                holdIsLayer: false,
            }),
        ).toBe('mod')
    })

    it('reads a layer-tap as a layer key', () => {
        expect(
            categoryForBinding({
                actionLabel: '&lt',
                bindingParam1: u(0x2c), // tap = Space
                isHoldTap: true,
                holdIsLayer: true,
            }),
        ).toBe('layer')
    })

    it('reads a momentary-layer behaviour as a layer key', () => {
        expect(categoryForBinding({ actionLabel: '&mo' })).toBe('layer')
    })

    it('falls back to the tap usage for plain &kp', () => {
        expect(
            categoryForBinding({ actionLabel: '&kp', bindingParam1: u(0x14) }),
        ).toBe('alpha')
    })
})

describe('catStyle', () => {
    it('returns neutral styling when colour coding is off', () => {
        expect(catStyle('mod', 'off').face).toBeNull()
    })

    it('returns neutral styling for hueless categories', () => {
        expect(catStyle('alpha', 'vivid').face).toBeNull()
    })

    it('tints hued categories and uses less chroma for subtle than vivid', () => {
        const subtle = catStyle('mod', 'subtle')
        const vivid = catStyle('mod', 'vivid')
        expect(subtle.face).not.toBeNull()
        expect(vivid.face).not.toBeNull()
        expect(subtle.face).not.toEqual(vivid.face)
    })
})

describe('categoryForBinding — non-HID behaviors by legend icon', () => {
    it.each<[string, string, KeyCategory]>([
        ['Bluetooth select', 'bluetooth', 'conn'],
        ['output to USB', 'usb', 'conn'],
        ['underglow toggle', 'underglow', 'light'],
        ['backlight up', 'backlight', 'light'],
        ['bootloader', 'bootloader', 'system'],
        ['mouse button', 'mouse-left', 'mouse'],
    ])('%s → %s', (_label, icon, expected) => {
        expect(categoryForBinding({ paramParts: [{ icon }] })).toBe(expected)
    })

    it('an HID usage wins over the icon', () => {
        expect(
            categoryForBinding({
                bindingParam1: u(0x14),
                paramParts: [{ icon: 'bluetooth' }],
            }),
        ).toBe('alpha')
    })

    it('an unknown icon falls back to the usage rule', () => {
        expect(categoryForBinding({ paramParts: [{ icon: 'toggle' }] })).toBe(
            'alpha',
        )
    })
})
