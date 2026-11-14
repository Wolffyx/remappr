// pattern-check: skip — assertions over the device-preview persist migration
import { describe, expect, it } from 'vitest'
import {
    MAX_SNAPSHOTS,
    migrateDevicePreviews,
    pruneSnapshots,
    type DevicePreviewSnapshot,
} from './devicePreviewStore'

describe('devicePreviewStore migration', () => {
    it('strips key legends from snapshots saved before v1', () => {
        const v0 = {
            snapshots: {
                dev: {
                    name: 'PM Test',
                    communication: 'serial',
                    keyCount: 1,
                    layerCount: 1,
                    savedAt: 1,
                    keys: [
                        {
                            x: 0,
                            y: 0,
                            width: 1,
                            height: 1,
                            category: 'alpha',
                            tap: 'A',
                            hold: 'L1',
                            action: 'Mod-Tap',
                        },
                    ],
                },
            },
        }
        const out = migrateDevicePreviews(v0, 0) as typeof v0
        expect(out.snapshots.dev.keys[0]).toEqual({
            x: 0,
            y: 0,
            width: 1,
            height: 1,
            category: 'alpha',
        })
        expect(out.snapshots.dev.name).toBe('PM Test')
    })
})

describe('pruneSnapshots', () => {
    const snap = (savedAt: number): DevicePreviewSnapshot => ({
        name: 'x',
        communication: 'hid',
        keyCount: 0,
        layerCount: 0,
        keys: [],
        savedAt,
    })

    // L4.12: every replug saved under a new key and nothing pruned the map.
    it('keeps only the most recently saved snapshots', () => {
        const out = pruneSnapshots({ a: snap(1), b: snap(3), c: snap(2) }, 2)
        expect(Object.keys(out).sort()).toEqual(['b', 'c'])
    })

    it('leaves a map under the cap as it is', () => {
        const map = { a: snap(1) }
        expect(pruneSnapshots(map, MAX_SNAPSHOTS)).toBe(map)
    })
})
