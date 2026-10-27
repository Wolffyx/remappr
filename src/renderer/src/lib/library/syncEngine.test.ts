// pattern-check: skip — unit tests over an in-memory fake of the cloud library
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { beforeEach, describe, expect, it } from 'vitest'
import { parseKeymap } from '@firmware/config'
import {
    CloudLibraryError,
    type CloudLibrary,
    type CloudRow,
} from './cloudLibrary'
import { keymapEntry } from './entries'
import { createMemoryLibrary, type LibraryRepository } from './localLibrary'
import { clientIdOf, createSyncEngine } from './syncEngine'
import { LOCAL_SYNC, type LibraryEntry } from './types'

const corne = parseKeymap(
    readFileSync(
        fileURLToPath(
            new URL(
                '../../../../firmware/config/__tests__/corne.keymap.json',
                import.meta.url,
            ),
        ),
        'utf8',
    ),
)

interface FakeItem {
    id: string
    clientId: string | null
    type: string
    name: string
    meta: Record<string, unknown>
    versions: unknown[]
    updatedAt: string
    deletedAt: string | null
}

/** The server's rules, in memory: idempotent create, version conflicts, a
 *  private-item quota and tombstones. */
function fakeCloud(quota = 10): CloudLibrary & {
    items: Map<string, FakeItem>
    editRemote(id: string, doc: unknown): void
} {
    const items = new Map<string, FakeItem>()
    let clock = 0
    const tick = (): string =>
        new Date(Date.UTC(2026, 0, 1, 0, 0, ++clock)).toISOString()
    const live = (): FakeItem[] =>
        [...items.values()].filter((i) => !i.deletedAt)
    return {
        items,
        editRemote(id, doc) {
            const it = items.get(id)!
            it.versions.push(doc)
            it.updatedAt = tick()
        },
        async create(item, document) {
            const prior = [...items.values()].find(
                (i) => i.clientId === item.clientId,
            )
            if (prior) return prior.id
            if (live().length >= quota)
                throw new CloudLibraryError('quota_exceeded', 'quota_exceeded')
            const id = crypto.randomUUID()
            items.set(id, {
                id,
                clientId: item.clientId,
                type: item.type,
                name: item.name,
                meta: item.meta,
                versions: [document],
                updatedAt: tick(),
                deletedAt: null,
            })
            return id
        },
        async save(itemId, base, changes) {
            const it = items.get(itemId)
            if (!it || it.deletedAt)
                throw new CloudLibraryError('forbidden', 'forbidden')
            const head = it.versions.length
            if (
                changes.document !== undefined &&
                JSON.stringify(changes.document) !==
                    JSON.stringify(it.versions[head - 1])
            ) {
                if (base !== head)
                    throw new CloudLibraryError(
                        'version_conflict',
                        'version_conflict',
                    )
                it.versions.push(changes.document)
            }
            if (changes.name) it.name = changes.name
            it.updatedAt = tick()
            return it.versions.length
        },
        async remove(itemId) {
            const it = items.get(itemId)
            if (!it) throw new CloudLibraryError('not_found', 'not_found')
            it.deletedAt = tick()
            it.updatedAt = it.deletedAt
        },
        async pull(since) {
            return [...items.values()]
                .filter((i) => !since || i.updatedAt > since)
                .sort((a, b) => a.updatedAt.localeCompare(b.updatedAt))
                .map(
                    (i): CloudRow => ({
                        id: i.id,
                        clientId: i.clientId,
                        type: i.type,
                        name: i.name,
                        headVersion: i.versions.length,
                        updatedAt: i.updatedAt,
                        deletedAt: i.deletedAt,
                    }),
                )
        },
        async fetch(heads) {
            return heads.map((h) => {
                const it = items.get(h.itemId)!
                return {
                    itemId: h.itemId,
                    version: h.version,
                    document: it.versions[h.version - 1],
                    meta: it.meta,
                }
            })
        },
        async head(itemId) {
            const it = items.get(itemId)
            return it && !it.deletedAt ? it.versions.length : null
        },
        async row(itemId) {
            const it = items.get(itemId)
            if (!it || it.deletedAt) return null
            return {
                id: it.id,
                clientId: it.clientId,
                type: it.type,
                name: it.name,
                headVersion: it.versions.length,
                updatedAt: it.updatedAt,
                deletedAt: null,
            }
        },
    }
}

const ACCOUNT = 'acct-1'

async function save(
    repo: LibraryRepository,
    name: string,
): Promise<LibraryEntry> {
    const e: LibraryEntry = {
        ...keymapEntry({ ...corne, meta: { ...corne.meta, name } }, 'config'),
        localId: crypto.randomUUID(),
        createdAt: 1,
        updatedAt: 1,
        sync: { ...LOCAL_SYNC },
    }
    await repo.put(e)
    return e
}

async function edit(
    repo: LibraryRepository,
    localId: string,
    name: string,
): Promise<void> {
    const e = (await repo.get(localId))!
    const source = keymapEntry(
        { ...corne, meta: { ...corne.meta, name } },
        'config',
    ).source
    await repo.put({
        ...e,
        name,
        source,
        updatedAt: e.updatedAt + 1,
        sync: { ...e.sync, dirty: e.sync.state !== 'local' },
    })
}

describe('syncEngine', () => {
    let cloud: ReturnType<typeof fakeCloud>
    let machineA: LibraryRepository
    let machineB: LibraryRepository

    beforeEach(() => {
        cloud = fakeCloud()
        machineA = createMemoryLibrary()
        machineB = createMemoryLibrary()
    })

    it('round-trips an entry across two machines', async () => {
        const a = createSyncEngine(machineA, cloud, ACCOUNT)
        const b = createSyncEngine(machineB, cloud, ACCOUNT)
        const e = await save(machineA, 'Corne')
        expect((await a.pushPending()).synced).toBe(1)
        const pushed = await machineA.get(e.localId)
        expect(pushed?.sync).toMatchObject({
            state: 'synced',
            baseVersion: 1,
            dirty: false,
            accountId: ACCOUNT,
        })
        expect(cloud.items.get(pushed!.sync.itemId!)?.meta).toMatchObject({
            device_kind: 'keyboard',
            target: 'zmk',
        })

        const first = await b.pull(null)
        expect(first.pulled).toBe(1)
        const onB = (await machineB.list())[0]
        expect(onB).toMatchObject({
            localId: e.localId,
            name: 'Corne',
            sync: { state: 'synced', baseVersion: 1 },
        })
        expect(parseKeymap(onB.source).layers.length).toBe(corne.layers.length)

        // B edits; A pulls the new version.
        await edit(machineB, onB.localId, 'Corne v2')
        await b.pushPending()
        const second = await a.pull(null)
        expect(second.pulled).toBe(1)
        expect(await machineA.get(e.localId)).toMatchObject({
            name: 'Corne v2',
            sync: { baseVersion: 2 },
        })
    })

    it('re-uploading after a lost reply does not duplicate', async () => {
        const a = createSyncEngine(machineA, cloud, ACCOUNT)
        const e = await save(machineA, 'Corne')
        await a.pushPending()
        await machineA.put({
            ...(await machineA.get(e.localId))!,
            sync: { ...LOCAL_SYNC },
        })
        await a.pushPending()
        expect(cloud.items.size).toBe(1)
    })

    it('an edit on both sides becomes a conflict, resolved three ways', async () => {
        const a = createSyncEngine(machineA, cloud, ACCOUNT)
        const e = await save(machineA, 'Corne')
        await a.pushPending()
        const itemId = (await machineA.get(e.localId))!.sync.itemId!
        cloud.items.get(itemId)!.name = 'Remote'
        cloud.editRemote(
            itemId,
            JSON.parse(
                keymapEntry(
                    { ...corne, meta: { ...corne.meta, name: 'Remote' } },
                    'config',
                ).source,
            ),
        )
        await edit(machineA, e.localId, 'Local')

        const res = await a.pull(null)
        expect(res.conflicts.map((c) => c.localId)).toEqual([e.localId])
        expect((await a.pushPending()).synced).toBe(0) // a conflict waits for the user

        await a.resolve(e.localId, 'both')
        const all = await machineA.list()
        expect(all).toHaveLength(2)
        expect(all.find((x) => x.localId === e.localId)?.sync).toMatchObject({
            state: 'synced',
            baseVersion: 2,
        })
        expect(all.find((x) => x.localId === e.localId)?.name).toBe('Remote')
        expect(all.find((x) => x.localId !== e.localId)?.name).toBe(
            'Local (this device)',
        )
    })

    it('keep mine overwrites the cloud head', async () => {
        const a = createSyncEngine(machineA, cloud, ACCOUNT)
        const e = await save(machineA, 'Corne')
        await a.pushPending()
        const itemId = (await machineA.get(e.localId))!.sync.itemId!
        cloud.editRemote(itemId, { kind: 'remappr.keymap', remote: true })
        await edit(machineA, e.localId, 'Local')
        expect((await a.push(e.localId))?.sync).toMatchObject({
            state: 'conflict',
            remoteVersion: 2,
        })
        await a.resolve(e.localId, 'mine')
        expect((await machineA.get(e.localId))?.sync).toMatchObject({
            state: 'synced',
            baseVersion: 3,
        })
    })

    it('marks entries over the quota and retries them later', async () => {
        cloud = fakeCloud(1)
        const a = createSyncEngine(machineA, cloud, ACCOUNT)
        await save(machineA, 'One')
        const two = await save(machineA, 'Two')
        expect((await a.pushPending()).synced).toBe(1)
        expect((await machineA.get(two.localId))?.sync.state).toBe('over_quota')
        expect((await a.pushPending()).synced).toBe(0)
        const [first] = [...cloud.items.values()]
        first.deletedAt = 'x'
        expect((await a.retryRefused()).synced).toBe(1)
    })

    it('hands cloud deletes back as tombstones; keep-local stops syncing', async () => {
        const a = createSyncEngine(machineA, cloud, ACCOUNT)
        const e = await save(machineA, 'Corne')
        await a.pushPending()
        await cloud.remove((await machineA.get(e.localId))!.sync.itemId!)
        const res = await a.pull(null)
        expect(res.tombstones.map((t) => t.localId)).toEqual([e.localId])
        await a.keepLocal(e.localId)
        expect((await machineA.get(e.localId))?.sync).toMatchObject({
            state: 'local',
            localOnly: true,
        })
        expect((await a.pushPending()).synced).toBe(0)
    })

    it('never pushes another account’s entries', async () => {
        const e = await save(machineA, 'Corne')
        await machineA.put({
            ...e,
            sync: { ...e.sync, accountId: 'someone-else' },
        })
        expect(
            (await createSyncEngine(machineA, cloud, ACCOUNT).pushPending())
                .synced,
        ).toBe(0)
        expect(cloud.items.size).toBe(0)
    })

    it('keeps an edit made while a push was in flight', async () => {
        const a = createSyncEngine(machineA, cloud, ACCOUNT)
        const e = await save(machineA, 'Corne')
        const slow = {
            ...cloud,
            create: async (...args: Parameters<CloudLibrary['create']>) => {
                await edit(machineA, e.localId, 'Edited meanwhile')
                return cloud.create(...args)
            },
        }
        await createSyncEngine(machineA, slow, ACCOUNT).push(e.localId)
        expect((await machineA.get(e.localId))?.sync).toMatchObject({
            state: 'synced',
            dirty: true,
        })
        await a.pushPending()
        expect((await machineA.get(e.localId))?.sync).toMatchObject({
            baseVersion: 2,
            dirty: false,
        })
    })

    it('gives legacy local ids a stable uuid client id', async () => {
        const uuid =
            /^[0-9a-f]{8}-[0-9a-f]{4}-8[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
        const id = await clientIdOf('my_keyboard-1793089561795')
        expect(id).toMatch(uuid)
        expect(await clientIdOf('my_keyboard-1793089561795')).toBe(id)
        const plain = crypto.randomUUID()
        expect(await clientIdOf(plain)).toBe(plain)

        const a = createSyncEngine(machineA, cloud, ACCOUNT)
        const e = await save(machineA, 'Legacy')
        const legacy = { ...e, localId: 'my_keyboard-1793089561795' }
        await machineA.remove(e.localId)
        await machineA.put(legacy)
        await a.pushPending()
        expect([...cloud.items.values()][0].clientId).toBe(id)
        // Lost reply: re-upload maps to the same item.
        await machineA.put({ ...legacy, sync: { ...LOCAL_SYNC } })
        await a.pushPending()
        expect(cloud.items.size).toBe(1)
        // Another machine pulls it under the uuid; this one keeps its id.
        await a.pull(null)
        expect((await machineA.list()).map((x) => x.localId)).toEqual([
            legacy.localId,
        ])
    })
})
