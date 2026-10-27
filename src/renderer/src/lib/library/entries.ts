// Pattern check: Dispatch Map (Tier 0) — applied — pure document ⇄ entry
// mappers; the cloud side picks a parser per document kind.
//
// How each document a user can save becomes a library entry. The builder and
// the editor both call these, so a board saved from either lists the same way.
import {
    describeDocument,
    parseKeymap,
    serializeKeymap,
    type CanonGeometry,
    type ConfigKeymap,
} from '@firmware/config'
import { layoutFromModel, parseDeviceLayout } from '@firmware/devices/schema'
import type { DeviceModel } from '@firmware/devices/types'
import type { PreviewKey } from '@/stores/devicePreviewStore'
import type {
    LibraryDocKind,
    LibraryEntry,
    LibraryItemType,
    NewLibraryEntry,
} from './types'

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

/** A `remappr.device` config (no geometry, so no preview). */
function deviceConfigEntry(
    source: string,
    type: LibraryItemType,
): NewLibraryEntry {
    const doc = JSON.parse(source) as { meta?: { name?: string } }
    return {
        type,
        kind: 'remappr.device',
        name: doc.meta?.name ?? 'Device',
        source,
        summary: {},
    }
}

function deviceLayoutFromSource(
    source: string,
    extra?: Record<string, unknown>,
): NewLibraryEntry {
    const parsed = parseDeviceLayout(source)
    if (!parsed.ok) throw new Error(parsed.error)
    return deviceLayoutEntry(parsed.model, extra?.firmware)
}

const FROM_SOURCE: Record<
    LibraryDocKind,
    (
        source: string,
        type: LibraryItemType,
        extra?: Record<string, unknown>,
    ) => NewLibraryEntry
> = {
    'remappr.keymap': (source, type) => keymapEntry(parseKeymap(source), type),
    'remappr.device-layout': (source, _type, extra) =>
        deviceLayoutFromSource(source, extra),
    'remappr.device': deviceConfigEntry,
}

/** Rebuild an entry (name, preview, summary) from a document that came from
 *  the cloud. Throws when the document does not parse. */
export function entryFromSource(
    kind: LibraryDocKind,
    source: string,
    type: LibraryItemType,
    extra?: Record<string, unknown>,
): NewLibraryEntry {
    return FROM_SOURCE[kind](source, type, extra)
}

/** The parsed document a cloud item stores. */
export function documentOf(entry: LibraryEntry): Record<string, unknown> {
    return JSON.parse(entry.source) as Record<string, unknown>
}

/** A cloud item's listing metadata and identifiers, from the firmware's
 *  describeDocument (the one source of truth). Identifiers only go on device
 *  items; the server refuses them elsewhere. */
export function cloudMetaOf(entry: LibraryEntry): {
    meta: Record<string, unknown>
    identifiers: string[]
} {
    const doc =
        entry.kind === 'remappr.keymap'
            ? parseKeymap(entry.source)
            : documentOf(entry)
    const d = describeDocument(doc)
    const meta: Record<string, unknown> = {
        ...(d?.deviceKind ? { device_kind: d.deviceKind } : {}),
        ...(d?.form ? { form: d.form } : {}),
        key_count: d?.keyCount ?? 0,
        control_count: d?.controlCount ?? 0,
        layer_count: d?.layerCount ?? 0,
        firmware: d?.firmware ?? [],
        target: d?.target ?? null,
        ...(entry.extra ? { extra: entry.extra } : {}),
        // A device image uploaded on publish (see PublishDialog).
        ...(typeof entry.extra?.imagePath === 'string'
            ? { image_path: entry.extra.imagePath }
            : {}),
    }
    const identifiers = entry.type === 'device' ? (d?.identifiers ?? []) : []
    return { meta, identifiers }
}
