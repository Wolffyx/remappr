// pattern-check: skip — assertions over the generic input-device store.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { HidMousePayload } from '@shared/ipc-types'
import type { GenericInputDevice } from '@firmware/generic'

const listHidMice = vi.fn<() => Promise<HidMousePayload[]>>()
vi.mock('@/electron/hidMice', () => ({ listHidMice: () => listHidMice() }))

const openService = vi.fn<(open: () => Promise<unknown>) => Promise<void>>()
vi.mock('../openService', () => ({
    openService: (open: () => Promise<unknown>) => openService(open),
}))

const { default: useInputDeviceStore, withoutFirmwareTwins } =
    await import('./inputDeviceStore')

const device = (id: string, usb?: string): GenericInputDevice =>
    ({ id, name: id, ...(usb ? { usb } : {}) }) as GenericInputDevice

const mouse = (name: string, productId = 2): HidMousePayload => ({
    name,
    vendorId: 0x046d,
    productId,
})

beforeEach(() => {
    listHidMice.mockReset()
    openService.mockReset()
    useInputDeviceStore.setState({ gamepads: [], mice: [] })
})

describe('withoutFirmwareTwins', () => {
    it('hides devices a firmware client already lists', () => {
        const out = withoutFirmwareTwins(
            [device('a', '1D50:615E'), device('b', '046D:C53F'), device('c')],
            ['Remappr Mouse · 1d50:615e · SN1'],
        )
        expect(out.map((d) => d.id)).toEqual(['b', 'c'])
    })
})

describe('refreshMice', () => {
    it('lists each HID mouse as a generic device', async () => {
        listHidMice.mockResolvedValue([mouse('G305', 0xc53f)])
        await useInputDeviceStore.getState().refreshMice()
        const [m] = useInputDeviceStore.getState().mice
        expect(m).toMatchObject({
            name: 'G305',
            form: 'mouse',
            usb: '046D:C53F',
        })
    })

    it('keeps the newest listing when an older one lands late', async () => {
        let resolveOld!: (v: HidMousePayload[]) => void
        listHidMice
            .mockReturnValueOnce(new Promise((r) => (resolveOld = r)))
            .mockResolvedValueOnce([mouse('New')])
        const old = useInputDeviceStore.getState().refreshMice()
        await useInputDeviceStore.getState().refreshMice()
        resolveOld([mouse('Old')])
        await old
        expect(useInputDeviceStore.getState().mice.map((m) => m.name)).toEqual([
            'New',
        ])
    })

    it('survives a failed listing', async () => {
        listHidMice.mockRejectedValue(new Error('no node-hid'))
        vi.spyOn(console, 'warn').mockImplementation(() => {})
        await useInputDeviceStore.getState().refreshMice()
        expect(useInputDeviceStore.getState().mice).toEqual([])
    })
})

describe('open', () => {
    it('opens the device through the shared open flow', async () => {
        const connect = vi.fn().mockResolvedValue('service')
        openService.mockImplementation(async (open) => {
            await open()
        })
        await useInputDeviceStore
            .getState()
            .open({ ...device('pad'), connect } as GenericInputDevice)
        expect(connect).toHaveBeenCalledTimes(1)
    })
})
