// pattern-check: skip — opt-in integration test against the local Supabase stack
//
// Needs the local functions served (`pnpm exec supabase functions serve
// --env-file supabase/functions/.env`) and E2E_API_URL, E2E_PUBLISHABLE_KEY,
// E2E_SERVICE_ROLE_KEY set (see supabase/README.md); skipped otherwise.
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it } from 'vitest'
import type { Database } from '@/lib/cloud/database.types'
import { licensePublicKey } from './keys'
import { verifyLicense } from './token'

const url = process.env.E2E_API_URL!
const key = process.env.E2E_PUBLISHABLE_KEY!

const b64url = (u: ArrayBuffer): string => Buffer.from(u).toString('base64url')

async function device(): Promise<{
    spki: string
    hash: string
    sign: (m: string) => Promise<string>
}> {
    const pair = await crypto.subtle.generateKey(
        { name: 'ECDSA', namedCurve: 'P-256' },
        false,
        ['sign', 'verify'],
    )
    const spki = await crypto.subtle.exportKey('spki', pair.publicKey)
    const hash = Buffer.from(
        await crypto.subtle.digest('SHA-256', spki),
    ).toString('hex')
    return {
        spki: b64url(spki),
        hash,
        sign: async (m) =>
            b64url(
                await crypto.subtle.sign(
                    { name: 'ECDSA', hash: 'SHA-256' },
                    pair.privateKey,
                    new TextEncoder().encode(m),
                ),
            ),
    }
}

async function activate(
    client: SupabaseClient<Database>,
    uid: string,
    d: Awaited<ReturnType<typeof device>>,
): Promise<{ token?: string; error?: string }> {
    const ts = Date.now()
    const { data, error } = await client.functions.invoke('license-activate', {
        body: {
            devicePublicKey: d.spki,
            proof: await d.sign(`${uid}.${d.hash}.${ts}`),
            ts,
            platform: 'web',
        },
    })
    if (error)
        return (await (error as { context: Response }).context.json()) as {
            error: string
        }
    return data as { token: string }
}

describe.skipIf(!url)('builder licenses against the local stack', () => {
    it('activates, verifies offline, caps devices, refreshes and revokes', async () => {
        const admin = createClient(url, process.env.E2E_SERVICE_ROLE_KEY!, {
            auth: { persistSession: false },
        })
        const email = `e2e-lic-${Date.now()}@test.local`
        const created = await admin.auth.admin.createUser({
            email,
            password: 'e2e-password-1',
            email_confirm: true,
        })
        if (created.error) throw created.error
        const uid = created.data.user.id
        const client = createClient<Database>(url, key, {
            auth: { persistSession: false },
        })
        await client.auth.signInWithPassword({
            email,
            password: 'e2e-password-1',
        })

        const first = await device()
        expect(await activate(client, uid, first)).toEqual({
            error: 'not_entitled',
        })

        const bought = await admin.rpc('billing_upsert', {
            p_row: {
                type: 'one_time',
                user_id: uid,
                plan_key: 'builder_lifetime',
                status: 'active',
                stripe_checkout_session_id: `cs_e2e_${Date.now()}`,
            },
        })
        if (bought.error) throw bought.error

        const { token } = await activate(client, uid, first)
        const verdict = verifyLicense(token!, {
            device: first.hash,
            machine: null,
            now: Date.now(),
            maxSeen: Date.now(),
            publicKey: (kid) => licensePublicKey(kid),
        })
        expect(verdict).toMatchObject({
            ok: true,
            claims: { sub: uid, plan: 'lifetime', exp: expect.any(Number) },
        })

        // A forged proof is refused.
        const other = await device()
        const ts = Date.now()
        const forged = await client.functions.invoke('license-activate', {
            body: {
                devicePublicKey: other.spki,
                proof: await first.sign(`${uid}.${other.hash}.${ts}`),
                ts,
                platform: 'web',
            },
        })
        expect(forged.error).toBeTruthy()

        await activate(client, uid, await device())
        await activate(client, uid, await device())
        expect(await activate(client, uid, await device())).toEqual({
            error: 'device_limit',
        })

        // get-package: "free" while the builder is free; per-user watermark once paid.
        const { data: freePlan } = await client
            .from('plans')
            .select('limits')
            .eq('key', 'free')
            .single()
        const paid =
            Number(
                (freePlan?.limits as { builder?: number } | null)?.builder ?? 0,
            ) === 0
        const anonPkg = await createClient<Database>(url, key, {
            auth: { persistSession: false },
        }).functions.invoke('get-package', { body: { hostApi: 1 } })
        const pkg = await client.functions.invoke('get-package', {
            body: { hostApi: 1, license: token },
        })
        const licensee = (
            JSON.parse((pkg.data as { manifest: string }).manifest) as {
                licensee: string
            }
        ).licensee
        if (paid) {
            expect(anonPkg.error).toBeTruthy()
            expect(licensee).toMatch(/^[0-9a-f]{32}$/)
        } else {
            expect(anonPkg.error).toBeNull()
            expect(licensee).toBe('free')
        }

        const refreshed = await client.functions.invoke('license-refresh', {
            body: { token },
        })
        expect((refreshed.data as { token?: string }).token).toBeTruthy()

        const { data: rows } = await client
            .from('licensed_devices')
            .select('id, device_pub_hash')
        const mine = rows!.find((r) => r.device_pub_hash === first.hash)!
        await client.rpc('deactivate_device', { p_id: mine.id })
        const revoked = await client.functions.invoke('license-refresh', {
            body: { token },
        })
        expect(revoked.data).toEqual({ revoked: true })

        await admin.auth.admin.deleteUser(uid)
    }, 30000)
})
