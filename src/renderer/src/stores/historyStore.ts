// Pattern check: no GoF pattern (-) — rejected — zustand store wiring the
// library's changes (debounced autosave) to recordVersion; mirrors syncStore's
// start/subscribe.
//
// Version history of library entries (plan §6c A, P10). It watches the
// library store, so every save path (editor, builder package, devices, sync
// pulls) gets history without calling it: a version is recorded
// AUTOSAVE_DELAY_MS after an entry's edits stop. "Save version" records a
// checkpoint now; restore and "copy as new" never rewrite history.
import { create, type StoreApi, type UseBoundStore } from 'zustand'
import { createLogger } from '@shared/logger'
import { entryFromSource } from '@/lib/library/entries'
import { recordVersion, type Snapshot } from '@/lib/library/history'
import type { LibraryEntry, NewLibraryEntry } from '@/lib/library/types'
import {
    createIndexedDbVersions,
    createMemoryVersions,
    type LocalVersion,
    type VersionKind,
    type VersionRepository,
} from '@/lib/library/versionRepo'
import useLibraryStore, { type LibraryState } from '@/stores/libraryStore'

const log = createLogger('History')
export const AUTOSAVE_DELAY_MS = 2000

export interface HistoryState {
    /** Versions per entry, oldest first, for entries someone has opened. */
    versions: Record<string, LocalVersion[]>
    load: (localId: string) => Promise<LocalVersion[]>
    /** "Save version": record the entry as it is now, with a message. */
    checkpoint: (localId: string, message: string) => Promise<void>
    /** Make version n the entry's document again (as a new checkpoint). */
    restore: (localId: string, n: number) => Promise<void>
    /** Save version n as a new library entry. */
    copyAsNew: (localId: string, n: number) => Promise<LibraryEntry | null>
    /** Make a past document (e.g. a cloud version) the entry's document. */
    restoreDocument: (
        localId: string,
        past: PastDocument,
        message: string,
    ) => Promise<void>
    /** A document pulled from GitHub becomes the entry's document, recorded
     *  as a 'github' version of that commit. Throws when it does not parse.
     *  Returns the version's number. */
    applyGithub: (
        localId: string,
        past: PastDocument,
        message: string,
        sha: string,
    ) => Promise<number | null>
    /** Save a past document as a new library entry with this name. */
    copyDocument: (
        localId: string,
        past: PastDocument,
        name: string,
    ) => Promise<LibraryEntry | null>
    /** Start watching the library; safe to call more than once. */
    start: () => void
}

type Library = UseBoundStore<StoreApi<LibraryState>>

interface Pending {
    timer: ReturnType<typeof setTimeout> | null
    /** The document before the first unsaved edit (for entries with no
     *  history yet, so the state before history began is kept too). */
    before?: Snapshot
}

const snapshotOf = (e: LibraryEntry): Snapshot => ({
    localId: e.localId,
    name: e.name,
    source: e.source,
})

/** A past document of an entry: a local version, or one fetched from the
 *  cloud. */
export interface PastDocument {
    name: string
    source: string
}

function rebuild(entry: LibraryEntry, version: PastDocument): NewLibraryEntry {
    const built = entryFromSource(
        entry.kind,
        version.source,
        entry.type,
        entry.extra,
    )
    return { ...built, name: version.name, source: version.source }
}

export function createHistoryStore(
    repo: VersionRepository,
    library: Library,
    delayMs: number = AUTOSAVE_DELAY_MS,
): UseBoundStore<StoreApi<HistoryState>> {
    const pending = new Map<string, Pending>()
    let known: Map<string, Snapshot> | null = null
    let started = false

    return create<HistoryState>()((set, get) => {
        const refresh = async (localId: string): Promise<LocalVersion[]> => {
            const list = await repo.list(localId)
            set({ versions: { ...get().versions, [localId]: list } })
            return list
        }

        const find = (localId: string): LibraryEntry | undefined =>
            library.getState().entries.find((e) => e.localId === localId)

        /** Record the entry now; cancels its pending autosave. */
        const record = async (
            localId: string,
            kind: VersionKind,
            message = '',
        ): Promise<LocalVersion | null> => {
            const p = pending.get(localId)
            if (p?.timer) clearTimeout(p.timer)
            pending.delete(localId)
            const entry = find(localId)
            if (!entry) return null
            const empty = (await repo.list(localId)).length === 0
            if (empty && p?.before)
                await recordVersion(repo, p.before, {
                    kind: 'autosave',
                    message: 'Before history',
                })
            const version = await recordVersion(repo, snapshotOf(entry), {
                kind,
                message,
            })
            await refresh(localId)
            return version
        }

        const autosave = (localId: string): void => {
            record(localId, 'autosave').catch((e: unknown) =>
                log.warn('autosave version failed', e),
            )
        }

        const schedule = (entry: LibraryEntry, before?: Snapshot): void => {
            const p = pending.get(entry.localId) ?? { timer: null, before }
            if (p.timer) clearTimeout(p.timer)
            p.timer = setTimeout(() => autosave(entry.localId), delayMs)
            pending.set(entry.localId, p)
        }

        const forget = (localId: string): void => {
            const p = pending.get(localId)
            if (p?.timer) clearTimeout(p.timer)
            pending.delete(localId)
            set({
                versions: Object.fromEntries(
                    Object.entries(get().versions).filter(
                        ([id]) => id !== localId,
                    ),
                ),
            })
            repo.removeAll(localId).catch((e: unknown) =>
                log.warn('could not drop the history of a removed entry', e),
            )
        }

        const onEntries = (entries: readonly LibraryEntry[]): void => {
            const next = new Map(entries.map((e) => [e.localId, snapshotOf(e)]))
            const prev = known
            known = next
            if (!prev) return
            for (const e of entries) {
                const was = prev.get(e.localId)
                if (!was) schedule(e)
                else if (was.source !== e.source || was.name !== e.name)
                    schedule(e, was)
            }
            for (const id of prev.keys()) if (!next.has(id)) forget(id)
        }

        return {
            versions: {},
            load: refresh,
            checkpoint: async (localId, message) => {
                await record(localId, 'checkpoint', message.trim())
            },
            restoreDocument: async (localId, past, message) => {
                const entry = find(localId)
                if (!entry) return
                await library.getState().update(localId, rebuild(entry, past))
                await record(localId, 'checkpoint', message)
            },
            applyGithub: async (localId, past, message, sha) => {
                const entry = find(localId)
                if (!entry) return null
                await library.getState().update(localId, rebuild(entry, past))
                const v = await record(localId, 'github', message)
                if (!v) return null
                await repo.put({ ...v, kind: 'github', message, gitSha: sha })
                await refresh(localId)
                return v.n
            },
            copyDocument: async (localId, past, name) => {
                const entry = find(localId)
                if (!entry) return null
                return library
                    .getState()
                    .save({ ...rebuild(entry, past), name })
            },
            restore: async (localId, n) => {
                const version = (await repo.list(localId)).find(
                    (v) => v.n === n,
                )
                if (!version) return
                await get().restoreDocument(
                    localId,
                    version,
                    `Restored version ${n}`,
                )
            },
            copyAsNew: async (localId, n) => {
                const version = (await repo.list(localId)).find(
                    (v) => v.n === n,
                )
                if (!version) return null
                return get().copyDocument(
                    localId,
                    version,
                    `${version.name} (version ${n})`,
                )
            },
            start: () => {
                if (started) return
                started = true
                // The first full read only learns what is there; history
                // starts with the next change.
                library.subscribe((s, prev) => {
                    if (s.status !== 'ready' || s.entries === prev.entries)
                        return
                    onEntries(s.entries)
                })
                if (library.getState().status === 'ready')
                    onEntries(library.getState().entries)
            },
        }
    })
}

function defaultRepository(): VersionRepository {
    if (typeof indexedDB !== 'undefined') return createIndexedDbVersions()
    log.warn('IndexedDB unavailable; version history is in-memory')
    return createMemoryVersions()
}

/** Local version history; the sync engine reads it to send checkpoints. */
export const historyRepository = defaultRepository()

const useHistoryStore = createHistoryStore(historyRepository, useLibraryStore)

export default useHistoryStore
