// pattern-check: skip — one-time hand-over of the old desktop storage; no
// store imports (it runs before any store module loads).
//
// Packaged desktop builds moved from file:// to app://remappr, a new storage
// origin. The main process reads the old file:// storage once (see
// src/main/storage-migration.ts); this writes it into the new origin without
// overwriting anything already there.
import { IpcChannels } from '@shared/ipc-types'
import { createIndexedDbLibrary } from '@/lib/library/localLibrary'
import type { LibraryEntry } from '@/lib/library/types'

interface StorageDump {
    localStorage: Record<string, string>
    library: LibraryEntry[]
}

interface IpcBridge {
    invoke(channel: string, ...args: unknown[]): Promise<unknown>
}

export async function takeStorageMigration(): Promise<void> {
    const api = (globalThis as { api?: IpcBridge }).api
    if (location.protocol !== 'app:' || !api) return
    try {
        const dump = (await api.invoke(
            IpcChannels.STORAGE_MIGRATION_TAKE,
        )) as StorageDump | null
        if (!dump) return
        for (const [key, value] of Object.entries(dump.localStorage))
            if (localStorage.getItem(key) === null)
                localStorage.setItem(key, value)
        const library = createIndexedDbLibrary()
        for (const entry of dump.library)
            if (!(await library.get(entry.localId))) await library.put(entry)
    } catch (e) {
        // The app still starts; the old data stays on disk under file://.
        console.warn(
            '[storage] could not carry the old desktop storage over',
            e,
        )
    }
}
