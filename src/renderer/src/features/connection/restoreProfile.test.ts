// pattern-check: skip — test fixtures + mock service for restoreProfile, no abstraction
import { describe, it, expect } from 'vitest'
import type { Capabilities, KeyboardService } from '@firmware/service'
import type { ActionType, Keymap, KeyAction, Layer } from '@firmware/types'
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

interface MockOptions {
    caps?: Partial<Capabilities>
    actionTypes?: ActionType[]
    /** Kinds the mock device rejects on setKey, as ZMK does for INVALID_PARAMETERS. */
    rejectKinds?: string[]
    /** Kinds the adapter reports as unbindable through `canSetAction`. */
    unsettableKinds?: string[]
}

/** Stateful mock KeyboardService covering only what restoreProfile touches. */
function makeService(
    initial: Layer[],
    opts: MockOptions = {},
): {
    service: KeyboardService
    calls: string[]
    writes: Array<{ layerId: number; position: number; action: KeyAction }>
    renamed: Array<[number, string]>
} {
    const state = {
        layers: initial.map((l) => ({ ...l, keys: [...l.keys] })),
        activeLayoutId: 0,
    }
    const calls: string[] = []
    const writes: Array<{
        layerId: number
        position: number
        action: KeyAction
    }> = []
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
            ...opts.caps,
        } as Capabilities,
        getKeymap: async () => {
            calls.push('getKeymap')
            return snapshot()
        },
        listActionTypes: async () => {
            calls.push('listActionTypes')
            return opts.actionTypes ?? []
        },
        buildKeyAction: (kind: string, params: number[]) => ka(kind, params),
        ...(opts.unsettableKinds
            ? {
                  canSetAction: (action: KeyAction): boolean =>
                      !opts.unsettableKinds?.includes(action.kind),
              }
            : {}),
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
        setKey: async (
            layerId: number,
            position: number,
            action: KeyAction,
        ) => {
            calls.push('setKey')
            if (opts.rejectKinds?.includes(action.kind)) {
                throw new Error(
                    `Failed to set key (layer ${layerId}, key ${position}): the keyboard rejected the binding parameters`,
                )
            }
            writes.push({ layerId, position, action })
            const l = state.layers.find((x) => x.id === layerId)
            if (l) l.keys[position] = action
        },
        setKeys: async () => {
            calls.push('setKeys')
        },
        commit: async () => {
            calls.push('commit')
        },
    }
    return {
        service: svc as unknown as KeyboardService,
        calls,
        writes,
        renamed,
    }
}

const actionType = (id: string, over: Partial<ActionType> = {}): ActionType =>
    ({ id, displayName: id, slots: [], ...over }) as unknown as ActionType

describe('restoreProfile', () => {
    it('writes every differing binding then commits, in that order', async () => {
        const { service, calls, writes } = makeService([
            layer(0, 'Base', [ka('kp', [4]), ka('kp', [5])]),
        ])
        const backup = backupOf(
            km([layer(7, 'Base', [ka('kp', [20]), ka('kp', [21])])]),
        )

        const result = await restoreProfile(service, backup)

        expect(writes).toEqual([
            { layerId: 0, position: 0, action: ka('kp', [20]) },
            { layerId: 0, position: 1, action: ka('kp', [21]) },
        ])
        expect(result.written).toBe(2)
        // Writes must precede commit.
        expect(calls.indexOf('setKey')).toBeLessThan(calls.indexOf('commit'))
        expect(calls.filter((c) => c === 'commit')).toHaveLength(1)
    })

    it('skips keys already matching the backup', async () => {
        const { service, calls, writes } = makeService([
            layer(0, 'Base', [ka('kp', [4]), ka('kp', [5])]),
        ])
        const backup = backupOf(
            km([layer(0, 'Base', [ka('kp', [4]), ka('kp', [99])])]),
        )

        const result = await restoreProfile(service, backup)

        expect(writes).toEqual([
            { layerId: 0, position: 1, action: ka('kp', [99]) },
        ])
        expect(result).toMatchObject({ written: 1, unchanged: 1 })
        expect(calls.filter((c) => c === 'setKey')).toHaveLength(1)
    })

    it('does not commit when every key already matches', async () => {
        const { service, calls } = makeService([
            layer(0, 'Base', [ka('kp', [4])]),
        ])
        const backup = backupOf(km([layer(0, 'Base', [ka('kp', [4])])]))

        const result = await restoreProfile(service, backup)

        expect(calls).not.toContain('commit')
        expect(result).toMatchObject({ written: 0, unchanged: 1 })
    })

    it('skips a binding the adapter reports as unsettable, without an RPC', async () => {
        // &ext_power reports no parameter metadata; ZMK rejects any non-zero param.
        const { service, calls, writes } = makeService(
            [layer(0, 'Base', [ka('kp', [4]), ka('trans', [0])])],
            {
                actionTypes: [actionType('ext_power', { settable: false })],
            },
        )
        const backup = backupOf(
            km([layer(0, 'Base', [ka('kp', [20]), ka('ext_power', [2])])]),
        )

        const result = await restoreProfile(service, backup)

        expect(writes).toEqual([
            { layerId: 0, position: 0, action: ka('kp', [20]) },
        ])
        expect(calls.filter((c) => c === 'setKey')).toHaveLength(1)
        expect(result.skipped).toEqual([
            expect.objectContaining({
                layerIndex: 0,
                layerName: 'Base',
                position: 1,
                reason: 'unsettable',
            }),
        ])
        expect(calls).toContain('commit')
    })

    it('skips a binding rejected by canSetAction', async () => {
        const { service, calls, writes } = makeService(
            [layer(0, 'Base', [ka('trans', [0])])],
            { unsettableKinds: ['mmv'] },
        )
        const backup = backupOf(km([layer(0, 'Base', [ka('mmv', [1])])]))

        const result = await restoreProfile(service, backup)

        expect(writes).toEqual([])
        expect(calls).not.toContain('setKey')
        expect(calls).not.toContain('commit')
        expect(result.skipped).toHaveLength(1)
    })

    it('lets canSetAction override the coarser settable flag', async () => {
        // ZMK marks &trans unsettable (no parameter metadata) yet accepts its
        // zero binding — skipping it would silently drop a real key on restore.
        const { service, writes } = makeService(
            [layer(0, 'Base', [ka('kp', [4])])],
            {
                actionTypes: [actionType('trans', { settable: false })],
                unsettableKinds: ['mmv'],
            },
        )
        const backup = backupOf(km([layer(0, 'Base', [ka('trans', [0])])]))

        const result = await restoreProfile(service, backup)

        expect(writes).toEqual([
            { layerId: 0, position: 0, action: ka('trans', [0]) },
        ])
        expect(result.skipped).toEqual([])
    })

    it('continues past a rejected key and still commits the rest', async () => {
        const { service, calls, writes } = makeService(
            [layer(0, 'Base', [ka('kp', [4]), ka('kp', [5]), ka('kp', [6])])],
            { rejectKinds: ['ext_power'] },
        )
        const backup = backupOf(
            km([
                layer(0, 'Base', [
                    ka('kp', [20]),
                    ka('ext_power', [2]),
                    ka('kp', [22]),
                ]),
            ]),
        )

        const result = await restoreProfile(service, backup)

        expect(writes).toEqual([
            { layerId: 0, position: 0, action: ka('kp', [20]) },
            { layerId: 0, position: 2, action: ka('kp', [22]) },
        ])
        expect(result.written).toBe(2)
        expect(result.failed).toEqual([
            expect.objectContaining({ position: 1, reason: 'rejected' }),
        ])
        expect(result.failed[0].message).toContain('rejected the binding')
        expect(calls).toContain('commit')
    })

    it('remaps layer-ref params to the live layer ids', async () => {
        const { service, writes } = makeService(
            [
                layer(0, 'Base', [ka('trans', [0])]),
                layer(1, 'Fn', [ka('trans', [0])]),
            ],
            {
                actionTypes: [
                    actionType('mo', {
                        slots: [{ label: 'Layer', kind: 'layer' }],
                    }),
                ],
            },
        )
        // Saved ids (40/41) differ from live ids (0/1); index 1 is the Fn layer.
        const backup = backupOf(
            km([
                layer(40, 'Base', [ka('mo', [41])]),
                layer(41, 'Fn', [ka('trans', [0])]),
            ]),
        )

        await restoreProfile(service, backup)

        expect(writes).toEqual([
            { layerId: 0, position: 0, action: ka('mo', [1]) },
        ])
    })

    it('leaves an unmappable layer param alone', async () => {
        const { service, writes } = makeService(
            [layer(0, 'Base', [ka('trans', [0])])],
            {
                actionTypes: [
                    actionType('mo', {
                        slots: [{ label: 'Layer', kind: 'layer' }],
                    }),
                ],
                caps: { variableLayerCount: false },
            },
        )
        const backup = backupOf(km([layer(40, 'Base', [ka('mo', [99])])]))

        await restoreProfile(service, backup)

        expect(writes).toEqual([
            { layerId: 0, position: 0, action: ka('mo', [99]) },
        ])
    })

    it('adds missing layers and renames them to the backup', async () => {
        const { service, calls, writes, renamed } = makeService([
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
        // Two layers × two keys.
        expect(writes).toHaveLength(4)
        // The freshly-added layer (id 100) is renamed to the saved name.
        expect(renamed).toContainEqual([100, 'Fn'])
        expect(writes).toContainEqual({
            layerId: 100,
            position: 0,
            action: ka('kp', [30]),
        })
    })

    it('removes extra layers to match the backup', async () => {
        const { service, calls, writes } = makeService([
            layer(0, 'Base', [ka('kp', [4])]),
            layer(1, 'Fn', [ka('kp', [9])]),
        ])
        const backup = backupOf(km([layer(0, 'Base', [ka('kp', [20])])]))

        await restoreProfile(service, backup)

        expect(calls).toContain('removeLayer')
        // Only the single remaining layer's key is written.
        expect(writes).toEqual([
            { layerId: 0, position: 0, action: ka('kp', [20]) },
        ])
    })

    it('does not add/remove layers when the firmware lacks variableLayerCount', async () => {
        const { service, calls } = makeService(
            [layer(0, 'Base', [ka('kp', [4])])],
            { caps: { variableLayerCount: false } },
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

    it('restores even when the action-type list is unavailable', async () => {
        const { service, writes } = makeService([
            layer(0, 'Base', [ka('kp', [4])]),
        ])
        const svc = service as unknown as {
            listActionTypes: () => Promise<never>
        }
        svc.listActionTypes = async (): Promise<never> => {
            throw new Error('nope')
        }
        const backup = backupOf(km([layer(0, 'Base', [ka('kp', [20])])]))

        const result = await restoreProfile(service, backup)

        expect(writes).toHaveLength(1)
        expect(result.written).toBe(1)
    })
})
