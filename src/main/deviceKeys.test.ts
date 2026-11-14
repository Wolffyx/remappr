// pattern-check: skip — assertions over the main-process stable device keys
import { describe, expect, it, vi } from 'vitest'

vi.mock('serialport', () => ({ SerialPort: { list: vi.fn() } }))

import { hidDeviceKey } from './hid'
import { serialDeviceKey } from './serial'

describe('hidDeviceKey', () => {
    // L4.12: the list keyed a device by /dev/hidrawN, which a replug changes.
    it('keys by vid, pid and the USB serial', () => {
        expect(
            hidDeviceKey({
                path: '/dev/hidraw3',
                vendorId: 0x1209,
                productId: 0x0001,
                serialNumber: 'E4A1C2',
            }),
        ).toBe('hid:1209:0001:E4A1C2')
    })

    it('has no key without a serial', () => {
        expect(
            hidDeviceKey({ vendorId: 0x1209, productId: 1, serialNumber: ' ' }),
        ).toBeUndefined()
    })
})

describe('serialDeviceKey', () => {
    it('keys by vid, pid and the USB serial', () => {
        expect(
            serialDeviceKey({
                vendorId: '1D50',
                productId: '615E',
                serialNumber: 'ABC123',
            }),
        ).toBe('serial:1d50:615e:ABC123')
    })

    it('ignores a Windows PnP instance fragment', () => {
        expect(
            serialDeviceKey({
                vendorId: '1d50',
                productId: '615e',
                serialNumber: '6&1A2B3C&0&1',
            }),
        ).toBeUndefined()
    })
})
