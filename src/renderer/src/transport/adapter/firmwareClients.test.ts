import { describe, it, expect } from 'vitest'
import type { FirmwareAdapter } from '@firmware/adapter'
import { getAdapters, registerAdapter } from '@firmware/registry'
import { discoverableClientDirs } from './firmwareClients'
import { hidDiscovery, hidDiscoveryAll } from './discovery'

// NOTE: these tests deliberately avoid the '@firmware' barrel and never execute
// the client barrels — importing real ZMK/QMK adapters pulls transport-client
// deps that don't resolve under vitest's node ESM (the Vite app bundles them
// fine). discoverableClientDirs() only reads glob KEYS, so no module runs.

describe('firmware client auto-discovery', () => {
    it('globs every adapter dir under the clients namespace', () => {
        const dirs = discoverableClientDirs()
        // Proves the alias glob ('@firmware/clients/*/index.ts') resolves.
        expect(dirs).toEqual(
            expect.arrayContaining([
                'remappr',
                'zmk',
                'qmk',
                'qmk-vial',
                'keychron',
                'mock',
            ]),
        )
        // catalog/config ship an index.ts but register no adapter. They live
        // outside the clients namespace, so the glob cannot reach them at all —
        // no hand-maintained exclusion list to drift.
        expect(dirs).not.toContain('catalog')
        expect(dirs).not.toContain('config')
    })
})

describe('discovery priority (load-order independence)', () => {
    // Priority is DECLARED by each adapter (Discovery.priority), not looked up
    // from a table of firmware names in the app — so these fakes carry their own
    // weight exactly as a real client would.
    const fakeHidAdapter = (
        id: string,
        usagePage: number,
        priority?: number,
    ): FirmwareAdapter =>
        ({
            id,
            displayName: id,
            discovery: {
                hid: { vendorIds: [usagePage], usagePage },
                ...(priority === undefined ? {} : { priority }),
            },
            canHandle: async () => ({ ok: false as const }),
            connect: async () => {
                throw new Error('not used')
            },
        }) as unknown as FirmwareAdapter

    it('pins the single HID filter to the highest-priority adapter, whenever it registers', () => {
        // Register a weightless adapter FIRST, the primary LAST — old behavior
        // (first-registered wins) would pick the weightless one.
        registerAdapter(fakeHidAdapter('secondary', 0xff01))
        registerAdapter(fakeHidAdapter('primary', 0xff00, 100))
        expect(getAdapters().map((a) => a.id)).toEqual(['secondary', 'primary'])
        expect(hidDiscovery()?.usagePage).toBe(0xff00)
    })

    it('hidDiscoveryAll surfaces every adapter filter, primary first', () => {
        // Reuses secondary(0xff01) + primary(0xff00) from the test above, plus
        // one more weightless family — the Electron path matches against ALL.
        registerAdapter(fakeHidAdapter('tertiary', 0xff60))
        const pages = hidDiscoveryAll().map((f) => f.usagePage)
        expect(pages[0]).toBe(0xff00) // the declared-priority adapter stays first
        expect(pages).toEqual(expect.arrayContaining([0xff00, 0xff01, 0xff60]))
    })
})
