// Pattern check: no GoF pattern (-) — rejected — single linear async procedure
// driving neutral KeyboardService ops; no abstraction or polymorphism warranted.
import type { KeyboardService } from '@firmware/service'
import type { ActionType, Keymap, KeyAction } from '@firmware/types'
import type { ProfileBackup } from '@/stores/profileBackupStore'

/** One backed-up key the restore could not write, and why. */
export interface RestoreIssue {
    /** Index of the layer in the backup (layer ids are reassigned on a wipe). */
    layerIndex: number
    layerName: string
    position: number
    /** Short human name for the binding, e.g. "&ext_power" or "External Power". */
    label: string
    /** `'unsettable'`: the firmware told us up front it cannot bind this over the
     *  wire. `'rejected'`: the device refused the write we attempted. */
    reason: 'unsettable' | 'rejected'
    message?: string
}

export interface RestoreResult {
    /** Fresh keymap read after the restore, for the editor. */
    keymap: Keymap
    /** Keys written to the device. */
    written: number
    /** Keys already matching the backup, so never written. */
    unchanged: number
    /** Keys the firmware cannot bind over its protocol — left as they are. */
    skipped: RestoreIssue[]
    /** Keys the device rejected when we tried. */
    failed: RestoreIssue[]
}

/**
 * Push a saved profile's full keymap back onto the live device, recovering a
 * wiped/reset keyboard. Firmware-neutral: uses only the shared KeyboardService
 * surface, so it works for any adapter whose `capabilities.profileRestore` is set.
 *
 * Steps: reconcile the device's layer set to the backup (add/remove/rename),
 * match the saved physical layout, then write each differing binding, and commit.
 *
 * Three rules keep a real keymap restorable, because a firmware cannot bind every
 * binding its own compiled keymap contains (ZMK `&ext_power` / `&mmv` / `&msc` /
 * parameterized macros report no parameter metadata and the device rejects them):
 *
 *  1. Keys already matching the backup are never rewritten — after a wipe the
 *     device is back on its compiled keymap, so the unbindable keys are usually
 *     already correct and need no RPC at all.
 *  2. Keys the firmware says it cannot bind are skipped, not attempted.
 *  3. A key the device rejects anyway is recorded and the restore continues, so
 *     one bad binding can't cost the user the other ten layers.
 *
 * The caller is responsible for ensuring the device is unlocked first.
 * Encoder bindings are not restored in this pass (see keymapHash).
 */
export async function restoreProfile(
    service: KeyboardService,
    backup: ProfileBackup,
): Promise<RestoreResult> {
    const caps = service.capabilities
    const saved = backup.keymap
    let live = await service.getKeymap()

    // 1. Reconcile layer count to the backup (only where the firmware supports it).
    if (caps.variableLayerCount) {
        while (live.layers.length < saved.layers.length) {
            await service.addLayer()
            live = await service.getKeymap()
        }
        while (live.layers.length > saved.layers.length) {
            const last = live.layers[live.layers.length - 1]
            await service.removeLayer(last.id)
            live = await service.getKeymap()
        }
    }

    // 2. Match the saved physical layout — this changes key positions/count, so
    //    it must happen before we compute per-position updates.
    if (saved.activeLayoutId !== live.activeLayoutId) {
        try {
            live = await service.setActivePhysicalLayout(saved.activeLayoutId)
        } catch (e) {
            console.warn('restoreProfile: failed to set physical layout', e)
        }
    }

    const types = await listActionTypes(service)
    const canSet = settabilityCheck(service, types)
    const layerParams = layerParamIndexes(types)
    // Layers are matched by index — ids differ after a wipe — so a saved layer-ref
    // param (&mo / &lt / &to) has to be translated to the live id at that index.
    const layerIdMap = new Map<number, number>()
    const layerCount = Math.min(saved.layers.length, live.layers.length)
    for (let i = 0; i < layerCount; i++) {
        layerIdMap.set(saved.layers[i].id, live.layers[i].id)
    }

    const skipped: RestoreIssue[] = []
    const failed: RestoreIssue[] = []
    let written = 0
    let unchanged = 0

    for (let i = 0; i < layerCount; i++) {
        const dev = live.layers[i]
        const src = saved.layers[i]
        if (caps.rename && dev.name !== src.name) {
            try {
                await service.renameLayer(dev.id, src.name)
            } catch (e) {
                console.warn('restoreProfile: failed to rename layer', e)
            }
        }
        const keyCount = Math.min(src.keys.length, dev.keys.length)
        for (let pos = 0; pos < keyCount; pos++) {
            const action = remapLayerParams(
                service,
                src.keys[pos],
                layerParams,
                layerIdMap,
            )
            const issue = (
                reason: RestoreIssue['reason'],
                message?: string,
            ): RestoreIssue => ({
                layerIndex: i,
                layerName: src.name,
                position: pos,
                label: describeAction(action),
                reason,
                ...(message ? { message } : {}),
            })

            if (sameAction(action, dev.keys[pos])) {
                unchanged++
                continue
            }
            if (!canSet(action)) {
                skipped.push(issue('unsettable'))
                continue
            }
            try {
                await service.setKey(dev.id, pos, action)
                written++
            } catch (e) {
                failed.push(
                    issue(
                        'rejected',
                        e instanceof Error ? e.message : String(e),
                    ),
                )
            }
        }
    }

    // Nothing written means nothing to persist — committing anyway would raise a
    // pointless save (and an error on firmwares that reject an empty save).
    if (written > 0) await service.commit()

    // Fresh read so the editor reflects the restored layout.
    return {
        keymap: await service.getKeymap(),
        written,
        unchanged,
        skipped,
        failed,
    }
}

async function listActionTypes(
    service: KeyboardService,
): Promise<ActionType[]> {
    try {
        return await service.listActionTypes()
    } catch (e) {
        // Without the type list we lose the up-front skip, not the restore: a
        // binding the firmware can't set just lands in `failed` instead.
        console.warn('restoreProfile: failed to list action types', e)
        return []
    }
}

/**
 * Whether the firmware can bind a given action, preferring the adapter's
 * per-binding answer over the per-behavior `settable` flag.
 *
 * The flag is deliberately coarse: it marks a behavior whose parameters the
 * firmware can't describe, which is a reason to hide it from the key picker but
 * not to refuse restoring it — those same behaviors still accept their zero
 * binding (ZMK `&trans`), and a restore that skipped those would leave real keys
 * behind. `canSetAction` judges the actual parameters, so it decides when present.
 */
function settabilityCheck(
    service: KeyboardService,
    types: ActionType[],
): (action: KeyAction) => boolean {
    if (service.canSetAction) {
        const check = service.canSetAction.bind(service)
        return (action) => check(action)
    }
    const unsettable = new Set(
        types.filter((t) => t.settable === false).map((t) => t.id),
    )
    return (action) => !unsettable.has(action.kind)
}

/** Param indexes holding a layer id, per action kind, from the neutral slots. */
function layerParamIndexes(types: ActionType[]): Map<string, number[]> {
    const out = new Map<string, number[]>()
    for (const t of types) {
        const indexes = t.slots
            .map((s, i) => (s.kind === 'layer' ? i : -1))
            .filter((i) => i >= 0)
        if (indexes.length > 0) out.set(t.id, indexes)
    }
    return out
}

/**
 * Translate a saved binding's layer-id params to the ids the device uses now.
 * Params that don't map (a layer the backup had and the device no longer does)
 * are left alone so the device gets the final say.
 */
function remapLayerParams(
    service: KeyboardService,
    action: KeyAction,
    layerParams: Map<string, number[]>,
    layerIdMap: Map<number, number>,
): KeyAction {
    const indexes = layerParams.get(action.kind)
    if (!indexes) return action
    let changed = false
    const params = action.params.map((p, i) => {
        if (!indexes.includes(i)) return p
        const mapped = layerIdMap.get(p)
        if (mapped === undefined || mapped === p) return p
        changed = true
        return mapped
    })
    if (!changed) return action
    // Rebuild through the adapter so the label reflects the new layer.
    return service.buildKeyAction(action.kind, params)
}

function sameAction(a: KeyAction, b: KeyAction | undefined): boolean {
    if (!b) return false
    return (
        a.kind === b.kind &&
        a.params.length === b.params.length &&
        a.params.every((p, i) => p === b.params[i])
    )
}

function describeAction(action: KeyAction): string {
    return (
        action.label?.bindingPrefix ||
        action.label?.primary ||
        `behavior ${action.kind}`
    )
}
