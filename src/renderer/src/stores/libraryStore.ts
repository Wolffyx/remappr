// Pattern check: no GoF pattern (-) — rejected — zustand store over an injected
// LibraryRepository (constructor-style DI through the factory); mirrors the
// other stores, no abstraction of its own.
//
// The reactive view of the local library. Every surface that lists or saves
// entries (builder, editor, devices) goes through here, so a save from a toolbar
// shows up in an open Library list without a re-read.
import { create, type StoreApi, type UseBoundStore } from 'zustand'
import { createLogger } from '@shared/logger'
import {
    createIndexedDbLibrary,
    createMemoryLibrary,
    type LibraryRepository,
} from '@/lib/library/localLibrary'
import { migrateLegacyLibrary } from '@/lib/library/migrateLegacy'
import {
    LOCAL_SYNC,
    type LibraryEntry,
    type NewLibraryEntry,
} from '@/lib/library/types'

const log = createLogger('LibraryStore')

type Changes = Partial<
    Pick<LibraryEntry, 'name' | 'source' | 'preview' | 'summary' | 'extra'>
>

export interface LibraryState {
    entries: LibraryEntry[]
    status: 'idle' | 'loading' | 'ready' | 'error'
    error: string | null
    /** Read the library (migrating the legacy localStorage one first). Safe to
     *  call repeatedly; later calls re-read. */
    load: () => Promise<void>
    save: (entry: NewLibraryEntry) => Promise<LibraryEntry>
    update: (localId: string, changes: Changes) => Promise<LibraryEntry | null>
    remove: (localId: string) => Promise<void>
}

function message(e: unknown): string {
    return e instanceof Error ? e.message : String(e)
}

function byNewest(entries: LibraryEntry[]): LibraryEntry[] {
    return [...entries].sort((a, b) => b.updatedAt - a.updatedAt)
}

export function createLibraryStore(
    repo: LibraryRepository,
    storage: Storage | null = globalThis.localStorage ?? null,
): UseBoundStore<StoreApi<LibraryState>> {
    let migrated = false
    return create<LibraryState>()((set, get) => ({
        entries: [],
        status: 'idle',
        error: null,
        load: async () => {
            set({ status: 'loading' })
            try {
                if (!migrated && storage) {
                    await migrateLegacyLibrary(repo, storage)
                    migrated = true
                }
                set({
                    entries: await repo.list(),
                    status: 'ready',
                    error: null,
                })
            } catch (e) {
                log.error('failed to read library', e)
                set({ status: 'error', error: message(e) })
            }
        },
        save: async (input) => {
            const now = Date.now()
            const entry: LibraryEntry = {
                ...input,
                localId: input.localId ?? crypto.randomUUID(),
                createdAt: now,
                updatedAt: now,
                sync: { ...LOCAL_SYNC },
            }
            await repo.put(entry)
            set({
                entries: byNewest([
                    entry,
                    ...get().entries.filter((e) => e.localId !== entry.localId),
                ]),
            })
            return entry
        },
        update: async (localId, changes) => {
            const current = get().entries.find((e) => e.localId === localId)
            if (!current) return null
            const entry: LibraryEntry = {
                ...current,
                ...changes,
                updatedAt: Date.now(),
                // A synced entry now differs from the cloud copy.
                sync: {
                    ...current.sync,
                    dirty: current.sync.state !== 'local',
                },
            }
            await repo.put(entry)
            set({
                entries: byNewest(
                    get().entries.map((e) =>
                        e.localId === localId ? entry : e,
                    ),
                ),
            })
            return entry
        },
        remove: async (localId) => {
            await repo.remove(localId)
            set({ entries: get().entries.filter((e) => e.localId !== localId) })
        },
    }))
}

function defaultRepository(): LibraryRepository {
    if (typeof indexedDB !== 'undefined') return createIndexedDbLibrary()
    log.warn('IndexedDB unavailable; library is in-memory for this session')
    return createMemoryLibrary()
}

const useLibraryStore = createLibraryStore(defaultRepository())

export default useLibraryStore
