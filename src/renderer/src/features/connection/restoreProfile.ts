// Pattern check: no GoF pattern (-) — rejected — single linear async procedure
// driving neutral KeyboardService ops; no abstraction or polymorphism warranted.
import type { KeyboardService } from '@firmware/service'
import type { Keymap, KeyUpdate } from '@firmware/types'
import type { ProfileBackup } from '@/stores/profileBackupStore'

/**
 * Push a saved profile's full keymap back onto the live device, recovering a
 * wiped/reset keyboard. Firmware-neutral: uses only the shared KeyboardService
 * surface, so it works for any adapter whose `capabilities.profileRestore` is set.
 *
 * Steps: reconcile the device's layer set to the backup (add/remove/rename),
 * match the saved physical layout, batch-write every binding via setKeys, then
 * commit. Returns the fresh keymap so the caller can refresh the editor.
 *
 * The caller is responsible for ensuring the device is unlocked first.
 * Encoder bindings are not restored in this pass (see keymapHash).
 */
export async function restoreProfile(
    service: KeyboardService,
    backup: ProfileBackup,
): Promise<Keymap> {
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

    // 3. Rename layers to match + build one flat batch of every binding. Layers
    //    are matched by index (ids differ after a wipe); counts may still differ
    //    if the firmware doesn't allow add/remove, so clamp to the overlap.
    const updates: KeyUpdate[] = []
    const layerCount = Math.min(saved.layers.length, live.layers.length)
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
            updates.push({
                layerId: dev.id,
                position: pos,
                action: src.keys[pos],
            })
        }
    }

    // 4. Write the whole profile in one batch, then persist it to the device.
    await service.setKeys(updates)
    await service.commit()

    // 5. Fresh read so the editor reflects the restored layout.
    return service.getKeymap()
}
