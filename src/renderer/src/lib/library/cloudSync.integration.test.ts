// pattern-check: skip — opt-in integration test against the local Supabase stack
//
// Runs only with E2E_API_URL, E2E_PUBLISHABLE_KEY and E2E_SERVICE_ROLE_KEY set
// (see supabase/README.md); skipped otherwise.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it } from 'vitest'
import { parseKeymap } from '@firmware/config'
import type { Database } from '@/lib/cloud/database.types'
import { createCloudLibrary } from './cloudLibrary'
import { createDeviceBackupRepository } from './deviceBackups'
import { keymapEntry } from './entries'
import { createMemoryLibrary } from './localLibrary'
import { createSyncEngine } from './syncEngine'
import { LOCAL_SYNC, type LibraryEntry } from './types'

const url = process.env.E2E_API_URL!
const key = process.env.E2E_PUBLISHABLE_KEY!
const adminClient = (): SupabaseClient =>
    createClient(url, process.env.E2E_SERVICE_ROLE_KEY!, {
        auth: { persistSession: false },
    })
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

async function account(
    admin: SupabaseClient,
    tag: string,
): Promise<{ id: string; client: SupabaseClient<Database> }> {
    const email = `e2e-${tag}-${Date.now()}@test.local`
    const { data, error } = await admin.auth.admin.createUser({
        email,
        password: 'e2e-password-1',
        email_confirm: true,
    })
    if (error) throw error
    const client = createClient<Database>(url, key, {
        auth: { persistSession: false },
    })
    const s = await client.auth.signInWithPassword({
        email,
        password: 'e2e-password-1',
    })
    if (s.error) throw s.error
    return { id: data.user.id, client }
}

describe.skipIf(!url)('library sync against the local stack', () => {
    it('round-trips across two machines, isolates accounts, enforces quota, backs up', async () => {
        const admin = adminClient()
        const alice = await account(admin, 'a')
        const bob = await account(admin, 'b')
        const machineA = createMemoryLibrary()
        const machineB = createMemoryLibrary()
        const a = createSyncEngine(
            machineA,
            createCloudLibrary(alice.client),
            alice.id,
        )
        const b = createSyncEngine(
            machineB,
            createCloudLibrary(alice.client),
            alice.id,
        )

        const entry: LibraryEntry = {
            ...keymapEntry(corne, 'config'),
            localId: crypto.randomUUID(),
            createdAt: 1,
            updatedAt: 1,
            sync: { ...LOCAL_SYNC },
        }
        await machineA.put(entry)
        const board: LibraryEntry = {
            ...keymapEntry(corne, 'device'),
            localId: crypto.randomUUID(),
            createdAt: 1,
            updatedAt: 1,
            sync: { ...LOCAL_SYNC },
        }
        await machineA.put(board)
        expect((await a.pushPending()).synced).toBe(2)

        const pulled = await b.pull(null)
        expect(pulled.pulled).toBe(2)
        const onB = await machineB.get(entry.localId)
        expect(parseKeymap(onB!.source).keyboard.keys.length).toBe(
            corne.keyboard.keys.length,
        )

        // B edits, A pulls version 2.
        const edited = keymapEntry(
            { ...corne, meta: { ...corne.meta, name: 'Edited on B' } },
            'config',
        )
        await machineB.put({
            ...onB!,
            name: edited.name,
            source: edited.source,
            updatedAt: 2,
            sync: { ...onB!.sync, dirty: true },
        })
        await b.pushPending()
        await a.pull(pulled.cursor)
        expect(await machineA.get(entry.localId)).toMatchObject({
            name: 'Edited on B',
            sync: { baseVersion: 2 },
        })

        // Concurrent edit → conflict, keep mine.
        const mineEdit = keymapEntry(
            { ...corne, meta: { ...corne.meta, name: 'A wins' } },
            'config',
        )
        const onA = (await machineA.get(entry.localId))!
        await machineA.put({
            ...onA,
            name: mineEdit.name,
            source: mineEdit.source,
            updatedAt: 3,
            sync: { ...onA.sync, dirty: true },
        })
        const onB2 = (await machineB.get(entry.localId))!
        const bEdit = keymapEntry(
            { ...corne, meta: { ...corne.meta, name: 'B again' } },
            'config',
        )
        await machineB.put({
            ...onB2,
            name: bEdit.name,
            source: bEdit.source,
            updatedAt: 3,
            sync: { ...onB2.sync, dirty: true },
        })
        await b.pushPending()
        expect((await a.push(entry.localId))?.sync.state).toBe('conflict')
        await a.resolve(entry.localId, 'mine')
        expect((await machineA.get(entry.localId))?.sync).toMatchObject({
            state: 'synced',
            baseVersion: 4,
        })

        // Bob sees none of it.
        const { data: bobView } = await bob.client
            .from('library_items')
            .select('id')
        expect(bobView).toEqual([])
        expect(
            (
                await createSyncEngine(
                    createMemoryLibrary(),
                    createCloudLibrary(bob.client),
                    bob.id,
                ).pull(null)
            ).pulled,
        ).toBe(0)

        // Quota: free = 10 private items; Alice has 2.
        for (let i = 0; i < 9; i++) {
            const e = {
                ...keymapEntry(
                    { ...corne, meta: { ...corne.meta, name: `n${i}` } },
                    'config',
                ),
                localId: crypto.randomUUID(),
                createdAt: 1,
                updatedAt: 1,
                sync: { ...LOCAL_SYNC },
            }
            await machineA.put(e)
        }
        const res = await a.pushPending()
        expect(res).toEqual({ attempted: 9, synced: 8 })
        expect(
            (await machineA.list()).filter(
                (e) => e.sync.state === 'over_quota',
            ),
        ).toHaveLength(1)

        // Delete on B → tombstone on A.
        await b.removeCloud(board.localId)
        const tomb = await a.pull(null)
        expect(tomb.tombstones.map((t) => t.localId)).toEqual([board.localId])

        // Device backup round trip.
        const repo = createDeviceBackupRepository(alice.client, alice.id)
        const backup = {
            deviceName: 'Corne',
            firmware: 'zmk',
            serialNumber: 'E2E-SERIAL',
            keymap: { layers: [], activeLayoutId: 0 } as never,
            hash: 'h1',
            savedAt: 1,
            cloud: true,
        }
        await repo.save(backup)
        await repo.save({ ...backup, hash: 'h2' })
        expect(await repo.find('E2E-SERIAL')).toMatchObject({
            hash: 'h2',
            serialNumber: 'E2E-SERIAL',
            cloud: true,
        })
        expect(
            await createDeviceBackupRepository(bob.client, bob.id).find(
                'E2E-SERIAL',
            ),
        ).toBeNull()

        await admin.auth.admin.deleteUser(alice.id)
        await admin.auth.admin.deleteUser(bob.id)
    }, 30000)
})
