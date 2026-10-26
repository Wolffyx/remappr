// Pattern check: no GoF pattern (-) — rejected — pure document → entry mappers.
//
// How each document a user can save becomes a library entry. The builder and
// the editor both call these, so a board saved from either lists the same way.
import {
    serializeKeymap,
    type CanonGeometry,
    type ConfigKeymap,
} from '@firmware/config'
import { layoutFromModel } from '@firmware/devices/schema'
import type { DeviceModel } from '@firmware/devices/types'
import type { PreviewKey } from '@/stores/devicePreviewStore'
import type { LibraryItemType, NewLibraryEntry } from './types'

/** Board geometry as a list-thumbnail silhouette (neutral category, no legends). */
export function geometryToPreviewKeys(keys: CanonGeometry[]): PreviewKey[] {
    return keys.map((k) => ({
        x: k.x,
        y: k.y,
        width: k.w,
        height: k.h,
        r: k.r,
        rx: k.rx,
        ry: k.ry,
        category: 'alpha',
    }))
}

/** A `remappr.keymap` document: a builder board (`device`) or an editor keymap
 *  (`config`). */
export function keymapEntry(
    config: ConfigKeymap,
    type: LibraryItemType,
): NewLibraryEntry {
    return {
        type,
        kind: 'remappr.keymap',
        name: config.meta.name,
        source: serializeKeymap(config),
        preview: geometryToPreviewKeys(config.keyboard.keys),
        summary: {
            keys: config.keyboard.keys.length,
            layers: config.layers.length,
        },
    }
}

/** A device layout designed in the builder, with its firmware choices beside it. */
export function deviceLayoutEntry(
    model: DeviceModel,
    firmware?: unknown,
): NewLibraryEntry {
    return {
        type: 'device',
        kind: 'remappr.device-layout',
        name: model.name,
        source: JSON.stringify(layoutFromModel(model)),
        summary: { controls: model.controls.length, form: model.form },
        ...(firmware ? { extra: { firmware } } : {}),
    }
}
