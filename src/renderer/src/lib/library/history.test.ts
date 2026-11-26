// pattern-check: skip — unit tests for the version rules and the history store.
import { IDBFactory } from 'fake-indexeddb'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AUTOSAVES_KEPT, recordVersion, type Snapshot } from './history'
import { createIndexedDbVersions, createMemoryVersions } from './versionRepo'

vi.mock('@/lib/library/entries', () => ({
    entryFromSource: (kind: string, source: string, type: string) => ({
        type,
        kind,
        name: 'rebuilt',
        source,
        summary: {},
    }),
}))

import { createLibraryStore } from '@/stores/libraryStore'
import { createHistoryStore } from '@/stores/historyStore'
import { createMemoryLibrary } from './localLibrary'

const snap = (source: string, name = 'Board'): Snapshot => ({
    localId: 'e1',
    name,
    source,
})

describe('recordVersion', () => {
    it('numbers versions and skips a document the newest one already holds', async () => {
        const repo = createMemoryVersions()
        await recordVersion(repo, snap('a'), { kind: 'autosave' })
        await recordVersion(repo, snap('a'), { kind: 'autosave' })
        await recordVersion(repo, snap('b'), { kind: 'autosave' })
        expect((await repo.list('e1')).map((v) => [v.n, v.source])).toEqual([
            [1, 'a'],
            [2, 'b'],
        ])
    })

    it('a checkpoint of the newest autosave promotes it instead of copying', async () => {
        const repo = createMemoryVersions()
        await recordVersion(repo, snap('a'), { kind: 'autosave' })
        await recordVersion(repo, snap('a'), {
            kind: 'checkpoint',
            message: 'thumb layer',
        })
        const [only, ...rest] = await repo.list('e1')
        expect(rest).toEqual([])
        expect(only).toMatchObject({
            n: 1,
            kind: 'checkpoint',
            message: 'thumb layer',
        })
        // A later autosave of the same document never demotes it.
        await recordVersion(repo, snap('a'), { kind: 'autosave' })
        expect((await repo.list('e1'))[0]?.kind).toBe('checkpoint')
    })

    it('a renamed entry is a new version', async () => {
        const repo = createMemoryVersions()
        await recordVersion(repo, snap('a', 'One'), { kind: 'autosave' })
        await recordVersion(repo, snap('a', 'Two'), { kind: 'autosave' })
        expect(await repo.list('e1')).toHaveLength(2)
    })

    it('keeps only the newest autosaves, never checkpoints', async () => {
        const repo = createMemoryVersions()
        await recordVersion(repo, snap('c0'), { kind: 'checkpoint' })
        for (let i = 1; i <= AUTOSAVES_KEPT + 5; i++)
            await recordVersion(repo, snap(`a${i}`), { kind: 'autosave' })
        const all = await repo.list('e1')
        expect(all.filter((v) => v.kind === 'autosave')).toHaveLength(
            AUTOSAVES_KEPT,
        )
        expect(all[0]).toMatchObject({ n: 1, kind: 'checkpoint' })
        expect(all.at(-1)?.n).toBe(AUTOSAVES_KEPT + 6)
    })

    it('works the same on IndexedDB, and forgets an entry', async () => {
        const repo = createIndexedDbVersions(new IDBFactory())
        await recordVersion(repo, snap('a'), { kind: 'autosave' })
        await recordVersion(repo, snap('b'), { kind: 'checkpoint' })
        await recordVersion(
            repo,
            { ...snap('x'), localId: 'e2' },
            {
                kind: 'autosave',
            },
        )
        expect((await repo.list('e1')).map((v) => v.n)).toEqual([1, 2])
        await repo.removeAll('e1')
        expect(await repo.list('e1')).toEqual([])
        expect(await repo.list('e2')).toHaveLength(1)
    })
})

describe('history store', () => {
    beforeEach(() => vi.useFakeTimers())
    afterEach(() => vi.useRealTimers())

    async function setup(): Promise<{
        library: ReturnType<typeof createLibraryStore>
        repo: ReturnType<typeof createMemoryVersions>
        history: ReturnType<typeof createHistoryStore>
        id: string
    }> {
        const library = createLibraryStore(createMemoryLibrary(), null)
        const repo = createMemoryVersions()
        const history = createHistoryStore(repo, library, 2000)
        await library.getState().load()
        history.getState().start()
        const entry = await library.getState().save({
            type: 'config',
            kind: 'remappr.keymap',
            name: 'Board',
            source: 'v1',
            summary: {},
        })
        return { library, repo, history, id: entry.localId }
    }

    const settle = async (): Promise<void> => {
        await vi.advanceTimersByTimeAsync(2000)
    }

    it('autosaves once edits stop, keeping the pre-history document', async () => {
        const { library, history, id } = await setup()
        await settle()
        await library.getState().update(id, { source: 'v2' })
        await library.getState().update(id, { source: 'v3' })
        await vi.advanceTimersByTimeAsync(1000)
        expect(history.getState().versions[id]?.map((v) => v.source)).toEqual([
            'v1',
        ])
        await settle()
        expect(history.getState().versions[id]?.map((v) => v.source)).toEqual([
            'v1',
            'v3',
        ])
    })

    it('history begins for entries saved before it with their old document', async () => {
        const library = createLibraryStore(createMemoryLibrary(), null)
        const entry = await library.getState().save({
            type: 'config',
            kind: 'remappr.keymap',
            name: 'Old',
            source: 'old',
            summary: {},
        })
        await library.getState().load()
        const history = createHistoryStore(createMemoryVersions(), library)
        history.getState().start()
        await library.getState().update(entry.localId, { source: 'new' })
        await settle()
        expect(
            history
                .getState()
                .versions[entry.localId]?.map((v) => [v.source, v.message]),
        ).toEqual([
            ['old', 'Before history'],
            ['new', ''],
        ])
    })

    it('checkpoint, restore and copy never rewrite history', async () => {
        const { library, history, id } = await setup()
        await settle()
        await library.getState().update(id, { source: 'v2' })
        await history.getState().checkpoint(id, ' add thumbs ')
        await history.getState().restore(id, 1)
        const versions = history.getState().versions[id] ?? []
        expect(versions.map((v) => [v.n, v.source, v.kind, v.message])).toEqual(
            [
                [1, 'v1', 'autosave', ''],
                [2, 'v2', 'checkpoint', 'add thumbs'],
                [3, 'v1', 'checkpoint', 'Restored version 1'],
            ],
        )
        const current = library.getState().entries.find((e) => e.localId === id)
        expect(current?.source).toBe('v1')
        // No stray autosave from the restore's own edit.
        await settle()
        expect(history.getState().versions[id]).toHaveLength(3)

        const copy = await history.getState().copyAsNew(id, 2)
        expect(copy).toMatchObject({ name: 'Board (version 2)', source: 'v2' })
        expect(library.getState().entries).toHaveLength(2)
    })

    it('removing an entry drops its history', async () => {
        const { library, repo, history, id } = await setup()
        await settle()
        expect(await repo.list(id)).toHaveLength(1)
        await library.getState().remove(id)
        await vi.runAllTimersAsync()
        expect(await repo.list(id)).toEqual([])
        expect(history.getState().versions[id]).toBeUndefined()
    })
})
