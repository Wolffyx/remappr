import { IDBFactory } from 'fake-indexeddb'
import { describe, expect, it } from 'vitest'
import { createLibraryStore } from '@/stores/libraryStore'
import { createIndexedDbLibrary, createMemoryLibrary } from './localLibrary'
import {
    LEGACY_BOARDS_KEY,
    LEGACY_DEVICE_LAYOUTS_KEY,
    MIGRATED_FLAG_KEY,
    migrateLegacyLibrary,
} from './migrateLegacy'
import { LOCAL_SYNC, type LibraryEntry } from './types'

function memoryStorage(seed: Record<string, string> = {}): Storage {
    const m = new Map(Object.entries(seed))
    return {
        get length() {
            return m.size
        },
        clear: () => m.clear(),
        getItem: (k) => m.get(k) ?? null,
        key: (i) => [...m.keys()][i] ?? null,
        removeItem: (k) => void m.delete(k),
        setItem: (k, v) => void m.set(k, v),
    }
}

function entry(localId: string, updatedAt: number): LibraryEntry {
    return {
        localId,
        type: 'config',
        kind: 'remappr.keymap',
        name: localId,
        source: '{}',
        summary: {},
        createdAt: updatedAt,
        updatedAt,
        sync: { ...LOCAL_SYNC },
    }
}

describe('IndexedDB library', () => {
    it('stores, lists newest first and removes', async () => {
        const repo = createIndexedDbLibrary(new IDBFactory())
        await repo.put(entry('a', 1))
        await repo.put(entry('b', 2))
        expect((await repo.list()).map((e) => e.localId)).toEqual(['b', 'a'])
        expect((await repo.get('a'))?.name).toBe('a')
        await repo.put({ ...entry('a', 3), name: 'renamed' })
        expect((await repo.list())[0]?.name).toBe('renamed')
        await repo.remove('b')
        expect((await repo.list()).map((e) => e.localId)).toEqual(['a'])
    })
})

const legacy = {
    [LEGACY_BOARDS_KEY]: JSON.stringify([
        {
            id: 'corne__1',
            name: 'Corne',
            keys: 42,
            savedAt: 10,
            source: '{"x":1}',
        },
    ]),
    [LEGACY_DEVICE_LAYOUTS_KEY]: JSON.stringify([
        {
            id: 'mouse__2',
            name: 'Mouse',
            form: 'mouse',
            controls: 5,
            savedAt: 20,
            doc: { kind: 'remappr.device-layout' },
            firmware: { targets: ['remappr'] },
        },
    ]),
}

describe('migrateLegacyLibrary', () => {
    it('copies boards and device layouts once, keeping the old keys', async () => {
        const repo = createMemoryLibrary()
        const storage = memoryStorage(legacy)
        expect(await migrateLegacyLibrary(repo, storage)).toBe(2)
        const [mouse, corne] = await repo.list()
        expect(corne).toMatchObject({
            localId: 'corne__1',
            type: 'device',
            kind: 'remappr.keymap',
            summary: { keys: 42 },
        })
        expect(mouse).toMatchObject({
            kind: 'remappr.device-layout',
            source: '{"kind":"remappr.device-layout"}',
            summary: { controls: 5, form: 'mouse' },
            extra: { firmware: { targets: ['remappr'] } },
        })
        expect(storage.getItem(LEGACY_BOARDS_KEY)).not.toBeNull()
        expect(storage.getItem(MIGRATED_FLAG_KEY)).not.toBeNull()
        expect(await migrateLegacyLibrary(repo, storage)).toBe(0)
    })

    it('never overwrites an entry already in the library', async () => {
        const repo = createMemoryLibrary()
        await repo.put({ ...entry('corne__1', 99), name: 'Edited' })
        await migrateLegacyLibrary(repo, memoryStorage(legacy))
        expect((await repo.get('corne__1'))?.name).toBe('Edited')
    })

    it('survives unreadable legacy JSON', async () => {
        const repo = createMemoryLibrary()
        const storage = memoryStorage({ [LEGACY_BOARDS_KEY]: '{nope' })
        expect(await migrateLegacyLibrary(repo, storage)).toBe(0)
    })
})

describe('library store', () => {
    it('migrates on first load, then saves, updates and removes', async () => {
        const store = createLibraryStore(
            createMemoryLibrary(),
            memoryStorage(legacy),
        )
        await store.getState().load()
        expect(store.getState().status).toBe('ready')
        expect(store.getState().entries).toHaveLength(2)

        const saved = await store.getState().save({
            type: 'config',
            kind: 'remappr.keymap',
            name: 'Mine',
            source: '{}',
            summary: { layers: 3 },
        })
        expect(saved.localId).toMatch(/[0-9a-f-]{36}/)
        expect(saved.sync).toEqual(LOCAL_SYNC)
        expect(store.getState().entries[0]?.localId).toBe(saved.localId)

        const updated = await store
            .getState()
            .update(saved.localId, { name: 'Renamed' })
        expect(updated?.name).toBe('Renamed')
        expect(updated?.sync.dirty).toBe(false)
        expect(
            await store.getState().update('missing', { name: 'x' }),
        ).toBeNull()

        await store.getState().remove(saved.localId)
        expect(store.getState().entries).toHaveLength(2)
    })

    it('marks a synced entry dirty on update', async () => {
        const repo = createMemoryLibrary()
        await repo.put({
            ...entry('s', 1),
            sync: { dirty: false, state: 'synced' },
        })
        const store = createLibraryStore(repo, null)
        await store.getState().load()
        const updated = await store
            .getState()
            .update('s', { source: '{"a":1}' })
        expect(updated?.sync).toEqual({ dirty: true, state: 'synced' })
    })
})
