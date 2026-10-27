// pattern-check: skip — opt-in integration test against the local Supabase stack
//
// Runs only with E2E_API_URL, E2E_PUBLISHABLE_KEY and E2E_SERVICE_ROLE_KEY set
// (see supabase/README.md); skipped otherwise.
import { createHmac } from 'node:crypto'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it } from 'vitest'
import type { Database } from '@/lib/cloud/database.types'
import { createCloudLibrary } from './cloudLibrary'
import { createCollectionLibrary } from './collectionLibrary'
import { createCommunityLibrary } from './communityLibrary'
import { createSocialLibrary } from './socialLibrary'

const url = process.env.E2E_API_URL!
const key = process.env.E2E_PUBLISHABLE_KEY!

/** RFC 6238 TOTP (SHA-1, 30 s, 6 digits) from a base32 secret. */
function totp(secret: string): string {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
    let bits = ''
    for (const ch of secret.replace(/=+$/, '').toUpperCase())
        bits += alphabet.indexOf(ch).toString(2).padStart(5, '0')
    const bytes = Buffer.from(bits.match(/.{8}/g)!.map((b) => parseInt(b, 2)))
    const counter = Buffer.alloc(8)
    counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000)))
    const h = createHmac('sha1', bytes).update(counter).digest()
    const o = h[h.length - 1] & 0xf
    return ((h.readUInt32BE(o) & 0x7fffffff) % 1_000_000)
        .toString()
        .padStart(6, '0')
}

async function account(
    admin: SupabaseClient,
    tag: string,
    username: string,
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
    const named = await client
        .from('users')
        .update({ username })
        .eq('id', data.user.id)
    if (named.error) throw named.error
    return { id: data.user.id, client }
}

describe.skipIf(!url)('social against the local stack', () => {
    it('stars, comments, reports, moderates and collects', async () => {
        const admin = createClient(url, process.env.E2E_SERVICE_ROLE_KEY!, {
            auth: { persistSession: false },
        })
        const stamp = Date.now().toString(36)
        const users = await Promise.all(
            ['sa', 'sb', 'sc', 'sd'].map((t) =>
                account(admin, t, `${t}${stamp}`),
            ),
        )
        const [alice, bob, carol, mod] = users

        const itemId = await createCloudLibrary(alice.client).create(
            {
                clientId: crypto.randomUUID(),
                type: 'config',
                name: `Chatty ${stamp}`,
                meta: {},
                identifiers: [],
            },
            { kind: 'remappr.keymap' },
        )
        await createCommunityLibrary(alice.client).publish(
            itemId,
            'public',
            'MIT',
            '',
        )

        const bobSocial = createSocialLibrary(bob.client)
        await bobSocial.star(itemId)
        expect(await bobSocial.isStarred(itemId)).toBe(true)
        await bobSocial.addComment(itemId, 'love it')
        const [top] = await bobSocial.comments(itemId)
        await createSocialLibrary(carol.client).addComment(
            itemId,
            'same',
            top.id,
        )
        expect(
            (await bobSocial.comments(itemId)).map((c) => [
                c.author,
                c.parentId,
            ]),
        ).toEqual([
            [`sb${stamp}`, null],
            [`sc${stamp}`, top.id],
        ])

        // Three reports flag the item; the admin needs MFA to see the queue.
        for (const u of [bob, carol, mod])
            await createSocialLibrary(u.client).report({ itemId }, 'spam', '')
        expect(await createCommunityLibrary(bob.client).item(itemId)).toBeNull()

        await admin.auth.admin.updateUserById(mod.id, {
            app_metadata: { role: 'admin' },
        })
        await mod.client.auth.refreshSession()
        const modSocial = createSocialLibrary(mod.client)
        await expect(modSocial.queue()).rejects.toMatchObject({
            message: 'forbidden',
        })
        const enrolled = await mod.client.auth.mfa.enroll({
            factorType: 'totp',
        })
        if (enrolled.error) throw enrolled.error
        const verified = await mod.client.auth.mfa.challengeAndVerify({
            factorId: enrolled.data.id,
            code: totp(enrolled.data.totp.secret),
        })
        if (verified.error) throw verified.error
        const queue = await modSocial.queue()
        expect(queue.find((q) => q.id === itemId)).toMatchObject({
            reports: 3,
            moderation: 'flagged',
        })
        await modSocial.moderate('item', itemId, 'ok')
        expect(
            (await createCommunityLibrary(bob.client).item(itemId))?.name,
        ).toBe(`Chatty ${stamp}`)

        // A collection lists only what the viewer can read.
        const privateId = await createCloudLibrary(alice.client).create(
            {
                clientId: crypto.randomUUID(),
                type: 'config',
                name: 'Private one',
                meta: {},
                identifiers: [],
            },
            { kind: 'remappr.keymap' },
        )
        const collections = createCollectionLibrary(alice.client, alice.id)
        const colId = await collections.create('Favourites')
        let [col] = await collections.mine()
        await collections.add(col, itemId, 'chatty')
        ;[col] = await collections.mine()
        await collections.add(col, privateId, '')
        expect((await collections.members(colId)).map((m) => m.name)).toEqual([
            `Chatty ${stamp}`,
            'Private one',
        ])
        await createCommunityLibrary(alice.client).publish(
            colId,
            'public',
            'CC0-1.0',
            '',
        )
        expect(
            (
                await createCollectionLibrary(bob.client, bob.id).members(colId)
            ).map((m) => m.name),
        ).toEqual([`Chatty ${stamp}`])

        for (const u of users) await admin.auth.admin.deleteUser(u.id)
    }, 30000)
})
