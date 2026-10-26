// Pattern check: Repository (Tier 0) — applied — hides IndexedDB transactions
// behind list/get/put/remove so the library store (and later the sync engine's
// cloud side) work against one contract.
//
// The local library lives in IndexedDB (`remappr-library`, store `entries`):
// no ~5 MB localStorage cap, so local saves are effectively unlimited. One code
// path for web and Electron.
import type { LibraryEntry } from './types'

export interface LibraryRepository {
    /** Every entry, newest first. */
    list(): Promise<LibraryEntry[]>
    get(localId: string): Promise<LibraryEntry | undefined>
    put(entry: LibraryEntry): Promise<void>
    remove(localId: string): Promise<void>
}

const DB_NAME = 'remappr-library'
const DB_VERSION = 1
const STORE = 'entries'

function request<T>(req: IDBRequest<T>): Promise<T> {
    return new Promise((resolve, reject) => {
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => reject(req.error)
    })
}

function done(tx: IDBTransaction): Promise<void> {
    return new Promise((resolve, reject) => {
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error)
        tx.onabort = () => reject(tx.error)
    })
}

function openDb(factory: IDBFactory): Promise<IDBDatabase> {
    const req = factory.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
        const store = req.result.createObjectStore(STORE, {
            keyPath: 'localId',
        })
        store.createIndex('type', 'type')
        store.createIndex('updatedAt', 'updatedAt')
    }
    return request(req)
}

export function createIndexedDbLibrary(
    factory: IDBFactory = indexedDB,
): LibraryRepository {
    let db: Promise<IDBDatabase> | null = null
    const objectStore = async (
        mode: IDBTransactionMode,
    ): Promise<{ tx: IDBTransaction; store: IDBObjectStore }> => {
        db ??= openDb(factory)
        const tx = (await db).transaction(STORE, mode)
        return { tx, store: tx.objectStore(STORE) }
    }
    return {
        async list() {
            const { store: s } = await objectStore('readonly')
            const all = await request(s.getAll() as IDBRequest<LibraryEntry[]>)
            return all.sort((a, b) => b.updatedAt - a.updatedAt)
        },
        async get(localId) {
            const { store: s } = await objectStore('readonly')
            return request(
                s.get(localId) as IDBRequest<LibraryEntry | undefined>,
            )
        },
        async put(entry) {
            const { tx, store: s } = await objectStore('readwrite')
            s.put(entry)
            await done(tx)
        },
        async remove(localId) {
            const { tx, store: s } = await objectStore('readwrite')
            s.delete(localId)
            await done(tx)
        },
    }
}

/** In-memory repository for tests and for browsers that block IndexedDB. */
export function createMemoryLibrary(): LibraryRepository {
    const entries = new Map<string, LibraryEntry>()
    return {
        list: async () =>
            [...entries.values()].sort((a, b) => b.updatedAt - a.updatedAt),
        get: async (localId) => entries.get(localId),
        put: async (entry) => {
            entries.set(entry.localId, structuredClone(entry))
        },
        remove: async (localId) => {
            entries.delete(localId)
        },
    }
}
