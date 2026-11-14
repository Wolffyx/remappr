// pattern-check: skip — assertions over the stable per-device key
import { describe, expect, it } from 'vitest'

import { deviceKey } from './deviceKey'

describe('deviceKey', () => {
    // L4.12: per-device state was keyed by the OS path, which a replug changes.
    it('keys by the device-reported identity when there is one', () => {
        const before = { id: '/dev/hidraw3', key: 'hid:1209:0001:E4A1' }
        const after = { id: '/dev/hidraw7', key: 'hid:1209:0001:E4A1' }
        expect(deviceKey(before)).toBe(deviceKey(after))
    })

    it('falls back to the transport id', () => {
        expect(deviceKey({ id: 'web-hid:1209:1:0' })).toBe('web-hid:1209:1:0')
    })
})
