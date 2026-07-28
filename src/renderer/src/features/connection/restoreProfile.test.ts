// pattern-check: skip — test fixtures + mock service for restoreProfile, no abstraction
import { describe, it, expect } from 'vitest'
import type { Capabilities, KeyboardService } from '@firmware/service'
import type { Keymap, KeyAction, KeyUpdate, Layer } from '@firmware/types'
import { restoreProfile } from './restoreProfile'
import type { ProfileBackup } from '@/stores/profileBackupStore'

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

const backupOf = (keymap: Keymap): ProfileBackup => ({
    deviceName: 'Test',
    firmware: 'zmk',
    keymap,
    hash: 'x',
    savedAt: 0,
})

/** Stateful mock KeyboardService covering only what restoreProfile touches. */
function makeService(
    initial: Layer[],
    caps?: Partial<Capabilities>,
): {
    service: KeyboardService
    calls: string[]
    setKeysBatches: KeyUpdate[][]
    renamed: Array<[number, string]>
} {
    const state = {
        layers: initial.map((l) => ({ ...l, keys: [...l.keys] })),
        activeLayoutId: 0,
    }
    const calls: string[] = []
    const setKeysBatches: KeyUpdate[][] = []
    const renamed: Array<[number, string]> = []
    let nextId = 100

    const snapshot = (): Keymap => ({
        layers: state.layers.map((l) => ({ ...l, keys: [...l.keys] })),
        availableLayers: 8,
        activeLayoutId: state.activeLayoutId,
        layouts: [],
    })
    const keyWidth = (): number => state.layers[0]?.keys.length ?? 0

    const svc = {
        deviceInfo: { name: 'Test', firmware: 'zmk', serialNumber: 'S' },
        capabilities: {
            variableLayerCount: true,
            rename: true,
            ...caps,
        } as Capabilities,
        getKeymap: async () => {
            calls.push('getKeymap')
            return snapshot()
        },
        addLayer: async () => {
            calls.push('addLayer')
            const l = {
                id: nextId++,
                name: 'new',
                keys: Array.from({ length: keyWidth() }, () => ka('trans')),
            }
            state.layers.push(l)
            return l
        },
        removeLayer: async (id: number) => {
            calls.push('removeLayer')
            state.layers = state.layers.filter((l) => l.id !== id)
        },
        renameLayer: async (id: number, name: string) => {
            calls.push('renameLayer')
            renamed.push([id, name])
            const l = state.layers.find((x) => x.id === id)
            if (l) l.name = name
        },
        moveLayer: async () => {
            calls.push('moveLayer')
        },
        setActivePhysicalLayout: async (layoutId: number) => {
            calls.push('setActivePhysicalLayout')
            state.activeLayoutId = layoutId
            return snapshot()
        },
        setKeys: async (u: KeyUpdate[]) => {
            calls.push('setKeys')
            setKeysBatches.push(u)
        },
        commit: async () => {
            calls.push('commit')
        },
    }
    return {
        service: svc as unknown as KeyboardService,
        calls,
        setKeysBatches,
        renamed,
    }
}

describe('restoreProfile', () => {
    it('batches every binding then commits, in that order', async () => {
        const { service, calls, setKeysBatches } = makeService([
            layer(0, 'Base', [ka('kp', [4]), ka('kp', [5])]),
        ])
        const backup = backupOf(
            km([layer(7, 'Base', [ka('kp', [20]), ka('kp', [21])])]),
        )

        await restoreProfile(service, backup)

        expect(setKeysBatches).toHaveLength(1)
        expect(setKeysBatches[0]).toEqual([
            { layerId: 0, position: 0, action: ka('kp', [20]) },
            { layerId: 0, position: 1, action: ka('kp', [21]) },
        ])
        // setKeys must precede commit.
        expect(calls.indexOf('setKeys')).toBeLessThan(calls.indexOf('commit'))
        expect(calls.filter((c) => c === 'commit')).toHaveLength(1)
    })

    it('adds missing layers and renames them to the backup', async () => {
        const { service, calls, setKeysBatches, renamed } = makeService([
            layer(0, 'Base', [ka('kp', [4]), ka('kp', [5])]),
        ])
        const backup = backupOf(
            km([
                layer(0, 'Base', [ka('kp', [20]), ka('kp', [21])]),
                layer(1, 'Fn', [ka('kp', [30]), ka('kp', [31])]),
            ]),
        )

        await restoreProfile(service, backup)

        expect(calls).toContain('addLayer')
        // One flat batch, two layers × two keys.
        expect(setKeysBatches[0]).toHaveLength(4)
        // The freshly-added layer (id 100) is renamed to the saved name.
        expect(renamed).toContainEqual([100, 'Fn'])
        expect(setKeysBatches[0]).toContainEqual({
            layerId: 100,
            position: 0,
            action: ka('kp', [30]),
        })
    })

    it('removes extra layers to match the backup', async () => {
        const { service, calls, setKeysBatches } = makeService([
            layer(0, 'Base', [ka('kp', [4])]),
            layer(1, 'Fn', [ka('kp', [9])]),
        ])
        const backup = backupOf(km([layer(0, 'Base', [ka('kp', [20])])]))

        await restoreProfile(service, backup)

        expect(calls).toContain('removeLayer')
        // Only the single remaining layer's key is written.
        expect(setKeysBatches[0]).toEqual([
            { layerId: 0, position: 0, action: ka('kp', [20]) },
        ])
    })

    it('does not add/remove layers when the firmware lacks variableLayerCount', async () => {
        const { service, calls } = makeService(
            [layer(0, 'Base', [ka('kp', [4])])],
            { variableLayerCount: false },
        )
        const backup = backupOf(
            km([
                layer(0, 'Base', [ka('kp', [20])]),
                layer(1, 'Fn', [ka('kp', [30])]),
            ]),
        )

        await restoreProfile(service, backup)

        expect(calls).not.toContain('addLayer')
        expect(calls).not.toContain('removeLayer')
    })
})
