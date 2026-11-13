// Pattern check: no GoF pattern (-) — rejected — a one-shot mapper from the two
// legacy localStorage arrays into library entries; plain functions.
//
// Before the IndexedDB library, the builder kept boards under localStorage
// `remappr.boards` and device layouts under `remappr.device-layouts`. They are
// copied in once; the old keys stay for a release so a rollback still finds them.
import { parseKeymap } from '@firmware/config'
import { createLogger } from '@shared/logger'
import type { PreviewKey } from '@/stores/devicePreviewStore'
import { geometryToPreviewKeys } from './entries'
import type { LibraryRepository } from './localLibrary'
import { LOCAL_SYNC, type LibraryEntry } from './types'

const log = createLogger('LibraryMigration')

export const LEGACY_BOARDS_KEY = 'remappr.boards'
export const LEGACY_DEVICE_LAYOUTS_KEY = 'remappr.device-layouts'
export const MIGRATED_FLAG_KEY = 'remappr.library.migrated'

interface LegacyBoard {
    id: string
    name: string
    keys: number
    savedAt: number
    source: string
    preview?: PreviewKey[]
}

interface LegacyDeviceLayout {
    id: string
    name: string
    form: string
    controls: number
    savedAt: number
    doc: unknown
    firmware?: unknown
}

function readArray<T>(storage: Storage, key: string): T[] {
    try {
        const raw: unknown = JSON.parse(storage.getItem(key) || '[]')
        return Array.isArray(raw) ? (raw as T[]) : []
    } catch (e) {
        log.error(`unreadable legacy ${key}`, e)
        return []
    }
}

/** Boards saved before thumbnails existed get one from their geometry. */
function boardPreview(b: LegacyBoard): PreviewKey[] | undefined {
    if (b.preview?.length) return b.preview
    try {
        return geometryToPreviewKeys(parseKeymap(b.source).keyboard.keys)
    } catch {
        return undefined // unparseable board: listed without a thumbnail
    }
}

export function boardToEntry(b: LegacyBoard): LibraryEntry {
    const preview = boardPreview(b)
    return {
        localId: b.id,
        type: 'device',
        kind: 'remappr.keymap',
        name: b.name,
        source: b.source,
        ...(preview ? { preview } : {}),
        summary: { keys: b.keys },
        createdAt: b.savedAt,
        updatedAt: b.savedAt,
        sync: { ...LOCAL_SYNC },
    }
}

export function deviceLayoutToEntry(d: LegacyDeviceLayout): LibraryEntry {
    return {
        localId: d.id,
        type: 'device',
        kind: 'remappr.device-layout',
        name: d.name,
        source: JSON.stringify(d.doc),
        summary: { controls: d.controls, form: d.form },
        ...(d.firmware ? { extra: { firmware: d.firmware } } : {}),
        createdAt: d.savedAt,
        updatedAt: d.savedAt,
        sync: { ...LOCAL_SYNC },
    }
}

/** Copy the legacy localStorage libraries into `repo`, once. Entries keep their
 *  legacy ids, so a retry after a partial run never duplicates. Returns how many
 *  entries were copied. */
export async function migrateLegacyLibrary(
    repo: LibraryRepository,
    storage: Storage = localStorage,
): Promise<number> {
    if (storage.getItem(MIGRATED_FLAG_KEY)) return 0
    const entries = [
        ...readArray<LegacyBoard>(storage, LEGACY_BOARDS_KEY).map(boardToEntry),
        ...readArray<LegacyDeviceLayout>(
            storage,
            LEGACY_DEVICE_LAYOUTS_KEY,
        ).map(deviceLayoutToEntry),
    ]
    const existing = new Set((await repo.list()).map((e) => e.localId))
    await Promise.all(
        entries.filter((e) => !existing.has(e.localId)).map((e) => repo.put(e)),
    )
    storage.setItem(MIGRATED_FLAG_KEY, String(Date.now()))
    return entries.length
}
