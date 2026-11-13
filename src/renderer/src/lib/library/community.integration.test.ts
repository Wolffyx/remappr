// pattern-check: skip — opt-in integration test against the local Supabase stack
//
// Runs only with E2E_API_URL, E2E_PUBLISHABLE_KEY and E2E_SERVICE_ROLE_KEY set
// (see supabase/README.md); skipped otherwise.
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it } from 'vitest'
import type { Database } from '@/lib/cloud/database.types'
import { createCloudLibrary } from './cloudLibrary'
import { createCommunityLibrary } from './communityLibrary'

const url = process.env.E2E_API_URL!
const key = process.env.E2E_PUBLISHABLE_KEY!

async function account(
    admin: SupabaseClient,
    tag: string,
    username: string | null,
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
    if (username) {
        const { error: nameError } = await client
            .from('users')
            .update({ username })
            .eq('id', data.user.id)
        if (nameError) throw nameError
    }
    return { id: data.user.id, client }
}

describe.skipIf(!url)('community against the local stack', () => {
    it('publishes, shares, searches, matches, forks and uploads an image', async () => {
        const admin = createClient(url, process.env.E2E_SERVICE_ROLE_KEY!, {
            auth: { persistSession: false },
        })
        const stamp = Date.now().toString(36)
        const alice = await account(admin, 'ca', `alice${stamp}`)
        const bob = await account(admin, 'cb', null)
        const aliceCloud = createCloudLibrary(alice.client)
        const aliceCommunity = createCommunityLibrary(alice.client)
        const bobCommunity = createCommunityLibrary(bob.client)
        const anonCommunity = createCommunityLibrary(
            createClient<Database>(url, key, {
                auth: { persistSession: false },
            }),
        )

        const boardId = await aliceCloud.create(
            {
                clientId: crypto.randomUUID(),
                type: 'device',
                name: `Zebra ${stamp}`,
                meta: { device_kind: 'keyboard', form: 'keyboard' },
                identifiers: [`zmk_name:zebra${stamp}`, 'usb:1d50:615e'],
            },
            { kind: 'remappr.keymap', rev: 1 },
        )
        const path = await aliceCommunity.uploadImage(
            alice.id,
            boardId,
            new Blob([new Uint8Array([0x52, 0x49, 0x46, 0x46])], {
                type: 'image/webp',
            }),
            'photo.webp',
        )
        await aliceCloud.save(boardId, 1, {
            meta: {
                device_kind: 'keyboard',
                form: 'keyboard',
                image_path: path,
            },
        })
        expect(
            await aliceCommunity.publish(
                boardId,
                'public',
                'CC-BY-4.0',
                'first',
            ),
        ).toBe(1)
        await aliceCloud.save(boardId, 1, {
            document: { kind: 'remappr.keymap', rev: 2 },
        })

        // Others see the release, not the draft.
        const seen = await bobCommunity.item(boardId)
        expect(
            seen?.releases.map((r) => (r.document as { rev: number }).rev),
        ).toEqual([1])
        expect(seen?.owner).toBe(`alice${stamp}`)
        expect(seen?.imageUrl).toContain(path)

        const hits = await anonCommunity.search(
            `zebra ${stamp}`,
            { type: 'device' },
            'new',
            0,
        )
        expect(hits.map((h) => h.id)).toContain(boardId)
        const [match] = await anonCommunity.match([
            `zmk_name:zebra${stamp}`,
            'usb:1d50:615e',
        ])
        expect(match).toEqual({ deviceId: boardId, score: 30 })

        // Unlisted: by link only.
        const cfgId = await aliceCloud.create(
            {
                clientId: crypto.randomUUID(),
                type: 'config',
                name: 'Secret cfg',
                meta: {},
                identifiers: [],
            },
            { kind: 'remappr.keymap' },
        )
        await aliceCommunity.publish(cfgId, 'unlisted', 'MIT', '')
        const token = (await aliceCommunity.shareToken(cfgId))!
        expect(await bobCommunity.item(cfgId)).toBeNull()
        expect((await anonCommunity.shared(token))?.name).toBe('Secret cfg')

        // Fork, then publishing needs a username.
        const forkId = await bobCommunity.fork(cfgId, token)
        await expect(
            bobCommunity.publish(forkId, 'public', 'MIT', ''),
        ).rejects.toMatchObject({
            message: 'username_required',
        })

        await admin.auth.admin.deleteUser(alice.id)
        await admin.auth.admin.deleteUser(bob.id)
    }, 30000)
})
