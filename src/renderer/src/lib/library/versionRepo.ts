// Pattern check: Repository (Tier 0) — applied — the versions store sits
// behind list/add/put/removeAll (like LibraryRepository), so the history logic
// runs against one contract in IndexedDB or in memory.
//
// Local version history (plan §6c A, P10): every library entry's past
// documents, offline and with no account. Its own IndexedDB database
// (`remappr-history`), so the library's schema never has to migrate for it.
export type VersionKind = 'autosave' | 'checkpoint' | 'github'

export interface LocalVersion {
    localId: string
    /** 1, 2, 3 … per entry; never reused. */
    n: number
    kind: VersionKind
    /** The checkpoint message (or what made the version, e.g. a restore). */
    message: string
    /** The entry's name and document at that point. */
    name: string
    source: string
    createdAt: number
    /** For a synced entry's checkpoint: the cloud version it became, or 0
     *  when it predates the cloud item and stays on this machine. Unset:
     *  not sent yet. */
    cloudVersion?: number
}

export interface VersionRepository {
    /** An entry's versions, oldest first. */
    list(localId: string): Promise<LocalVersion[]>
    /** Every entry's versions (for one pass over what still needs sending). */
    listAll(): Promise<LocalVersion[]>
    put(version: LocalVersion): Promise<void>
    remove(localId: string, n: number): Promise<void>
    removeAll(localId: string): Promise<void>
}

const DB_NAME = 'remappr-history'
const DB_VERSION = 1
const STORE = 'versions'

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
            keyPath: ['localId', 'n'],
        })
        store.createIndex('localId', 'localId')
    }
    return request(req)
}

const byNumber = (a: LocalVersion, b: LocalVersion): number => a.n - b.n

export function createIndexedDbVersions(
    factory: IDBFactory = indexedDB,
): VersionRepository {
    let db: Promise<IDBDatabase> | null = null
    const objectStore = async (
        mode: IDBTransactionMode,
    ): Promise<{ tx: IDBTransaction; store: IDBObjectStore }> => {
        db ??= openDb(factory)
        const tx = (await db).transaction(STORE, mode)
        return { tx, store: tx.objectStore(STORE) }
    }
    return {
        async list(localId) {
            const { store } = await objectStore('readonly')
            const all = await request(
                store.index('localId').getAll(localId) as IDBRequest<
                    LocalVersion[]
                >,
            )
            return all.sort(byNumber)
        },
        async listAll() {
            const { store } = await objectStore('readonly')
            return request(store.getAll() as IDBRequest<LocalVersion[]>)
        },
        async put(version) {
            const { tx, store } = await objectStore('readwrite')
            store.put(version)
            await done(tx)
        },
        async remove(localId, n) {
            const { tx, store } = await objectStore('readwrite')
            store.delete([localId, n])
            await done(tx)
        },
        async removeAll(localId) {
            const { tx, store } = await objectStore('readwrite')
            const keys = await request(
                store.index('localId').getAllKeys(localId),
            )
            for (const key of keys) store.delete(key)
            await done(tx)
        },
    }
}

/** In-memory versions for tests and browsers that block IndexedDB. */
export function createMemoryVersions(): VersionRepository {
    const rows = new Map<string, LocalVersion>()
    const key = (localId: string, n: number): string => `${localId}#${n}`
    return {
        list: async (localId) =>
            [...rows.values()]
                .filter((v) => v.localId === localId)
                .map((v) => structuredClone(v))
                .sort(byNumber),
        listAll: async () => [...rows.values()].map((v) => structuredClone(v)),
        put: async (version) => {
            rows.set(key(version.localId, version.n), structuredClone(version))
        },
        remove: async (localId, n) => {
            rows.delete(key(localId, n))
        },
        removeAll: async (localId) => {
            for (const v of [...rows.values()])
                if (v.localId === localId) rows.delete(key(v.localId, v.n))
        },
    }
}
