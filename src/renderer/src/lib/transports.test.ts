// pattern-check: skip — unit test with the adapter registry faked, no production logic
import { describe, expect, it, vi } from 'vitest'

const adapters = vi.hoisted(() => [] as unknown[])
vi.mock('@firmware/registry', () => ({ getAdapters: () => adapters }))
// web-ble's barrel import would register every real client (see L4.25).
vi.mock('@firmware', () => ({ UserCancelledError: class extends Error {} }))
vi.stubGlobal('window', {
    api: { invoke: vi.fn(async () => []), on: () => () => undefined },
})

const { getTransports } = await import('./transports')

const kinds = (): string[] => getTransports().map((t) => t.communication)

describe('getTransports (L4.25)', () => {
    it('picks up HID once the firmware clients register', () => {
        // First render, before the lazy client chunks have registered.
        expect(kinds()).not.toContain('hid')

        adapters.push({
            id: 'remappr',
            discovery: { hid: { vendorIds: [0x1d50], usagePage: 0xff00 } },
        })

        expect(kinds()).toContain('hid')
    })
})
