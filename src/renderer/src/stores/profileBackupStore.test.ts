// pattern-check: skip — test fixtures for backup hash/key helpers, no abstraction
import { describe, it, expect } from 'vitest'
import type { KeyboardService } from '@firmware/service'
import type { Keymap, KeyAction, Layer } from '@firmware/types'
import {
    backupKey,
    buildBackup,
    isPortableKey,
    keymapHash,
} from './profileBackupStore'

const ka = (kind: string, params: number[] = []): KeyAction =>
    ({ kind, params }) as unknown as KeyAction

const layer = (id: number, name: string, keys: KeyAction[]): Layer => ({
    id,
    name,
    keys,
})

const km = (layers: Layer[], activeLayoutId = 0): Keymap => ({
    layers,
    availableLayers: 8,
    activeLayoutId,
    layouts: [],
})

const svc = (deviceInfo: {
    serialNumber?: string
    name?: string
    vid?: number
    pid?: number
}): KeyboardService =>
    ({
        deviceInfo: { firmware: 'zmk', ...deviceInfo },
    }) as unknown as KeyboardService

describe('keymapHash', () => {
    it('ignores layer ids (stable across id reassignment)', () => {
        const a = km([layer(0, 'Base', [ka('kp', [4]), ka('kp', [5])])])
        const b = km([layer(42, 'Base', [ka('kp', [4]), ka('kp', [5])])])
        expect(keymapHash(a)).toBe(keymapHash(b))
    })

    it('changes when a binding changes', () => {
        const a = km([layer(0, 'Base', [ka('kp', [4])])])
        const b = km([layer(0, 'Base', [ka('kp', [6])])])
        expect(keymapHash(a)).not.toBe(keymapHash(b))
    })

    it('changes when a layer is renamed', () => {
        const a = km([layer(0, 'Base', [ka('kp', [4])])])
        const b = km([layer(0, 'Gaming', [ka('kp', [4])])])
        expect(keymapHash(a)).not.toBe(keymapHash(b))
    })

    it('changes with the active physical layout', () => {
        const a = km([layer(0, 'Base', [ka('kp', [4])])], 0)
        const b = km([layer(0, 'Base', [ka('kp', [4])])], 1)
        expect(keymapHash(a)).not.toBe(keymapHash(b))
    })

    it('ignores encoder bindings (v1 restores keys only)', () => {
        const a = km([layer(0, 'Base', [ka('kp', [4])])])
        const b = km([
            {
                ...layer(0, 'Base', [ka('kp', [4])]),
                encoders: [{ cw: ka('vol', [1]), ccw: ka('vol', [2]) }],
            },
        ])
        expect(keymapHash(a)).toBe(keymapHash(b))
    })
})

describe('backupKey', () => {
    it('prefers the hardware serial', () => {
        expect(
            backupKey(svc({ serialNumber: 'SER', name: 'Kbd' }), 'tid'),
        ).toBe('SER')
    })

    it('falls back to the transport id, then the name', () => {
        expect(backupKey(svc({ name: 'Kbd' }), 'tid')).toBe('tid')
        expect(backupKey(svc({ name: 'Kbd' }), null)).toBe('Kbd')
    })
})

describe('buildBackup', () => {
    it('captures the keymap and computes its hash', () => {
        const keymap = km([layer(0, 'Base', [ka('kp', [4])])])
        const b = buildBackup(
            svc({ serialNumber: 'S', name: 'Kbd' }),
            keymap,
            123,
        )
        expect(b.keymap).toBe(keymap)
        expect(b.hash).toBe(keymapHash(keymap))
        expect(b.savedAt).toBe(123)
        expect(b.firmware).toBe('zmk')
    })

    it('records the device identity for cross-host matching', () => {
        const b = buildBackup(
            svc({ serialNumber: 'SER', name: 'Kbd', vid: 0x1234, pid: 0x5678 }),
            km([layer(0, 'Base', [ka('kp', [4])])]),
            0,
        )
        expect(b.serialNumber).toBe('SER')
        expect(b.vid).toBe(0x1234)
        expect(b.pid).toBe(0x5678)
    })
})

describe('isPortableKey', () => {
    it('is true when the key is the hardware serial', () => {
        const b = buildBackup(
            svc({ serialNumber: 'SER', name: 'Kbd' }),
            km([layer(0, 'Base', [ka('kp', [4])])]),
            0,
        )
        // backupKey uses the serial when present, so key === serial.
        expect(isPortableKey('SER', b)).toBe(true)
    })

    it('is false for a host-local (transport-id / name) fallback key', () => {
        const b = buildBackup(
            svc({ name: 'Kbd' }), // no serial → keyed by transport id / name
            km([layer(0, 'Base', [ka('kp', [4])])]),
            0,
        )
        expect(isPortableKey('/dev/ttyACM0', b)).toBe(false)
        expect(isPortableKey('Kbd', b)).toBe(false)
    })

    it('is false when the stored key does not match the recorded serial', () => {
        const b = buildBackup(
            svc({ serialNumber: 'SER', name: 'Kbd' }),
            km([layer(0, 'Base', [ka('kp', [4])])]),
            0,
        )
        expect(isPortableKey('some-other-key', b)).toBe(false)
    })
})
