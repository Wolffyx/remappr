// pattern-check: skip — assertions over the device-preview persist migration
import { describe, expect, it } from 'vitest'
import { migrateDevicePreviews } from './devicePreviewStore'

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
