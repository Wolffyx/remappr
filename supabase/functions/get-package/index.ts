// pattern-check: skip — one request handler: decide who may have the builder,
// watermark a copy, sign its manifest, log it.
//
// POST { hostApi, version?, license? }. While the builder is free (the free
// plan grants it) anyone gets the newest stable package for their host API,
// watermarked "free". Once it is paid, a valid license for an active device is
// required; the copy is watermarked with hmac(WATERMARK_KEY, user) and every
// delivery is logged (10 a day per user). Replies
// { manifest: <the exact signed JSON text>, signature, kid, files: {path: base64} }.
import { encodeBase64 } from 'jsr:@std/encoding@1/base64'
import { createClient } from 'npm:@supabase/supabase-js@2.118.0'
import { ed25519 } from 'npm:@noble/curves@2.2.0/ed25519.js'
import {
    adminClient,
    json,
    licenseState,
    preflight,
    readOwnLicense,
    sha256Hex,
} from '../_shared/license.ts'

const PLACEHOLDER = '__REMAPPR_LICENSEE__'
const enc = new TextEncoder()

interface GetBody {
    hostApi?: number
    version?: string
    license?: string
}

interface StoredManifest {
    name: string
    version: string
    hostApi: string
    hostModules: string[]
    files: { path: string; sha256: string; bytes: number }[]
}

function hexToBytes(hex: string): Uint8Array {
    return Uint8Array.from(hex.match(/../g)!.map((h) => parseInt(h, 16)))
}

async function watermarkFor(user: string): Promise<string> {
    const secret = Deno.env.get('WATERMARK_KEY')
    if (!secret) throw new Error('watermark key is not configured')
    const key = await crypto.subtle.importKey(
        'raw',
        hexToBytes(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign'],
    )
    const mac = new Uint8Array(
        await crypto.subtle.sign('HMAC', key, enc.encode(user)),
    )
    return [...mac]
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('')
        .slice(0, 32)
}

function signManifest(text: string): { signature: string; kid: string } {
    const hex = Deno.env.get('PACKAGE_SIGNING_KEY')
    const kid = Deno.env.get('PACKAGE_SIGNING_KID')
    if (!hex || !kid) throw new Error('package signing key is not configured')
    return {
        signature: encodeBase64(
            ed25519.sign(enc.encode(text), hexToBytes(hex)),
        ),
        kid,
    }
}

Deno.serve(async (req) => {
    const early = preflight(req)
    if (early) return early
    const body = (await req.json().catch(() => ({}))) as GetBody
    if (typeof body.hostApi !== 'number')
        return json({ error: 'bad_request' }, 400)

    // Public reads (the free plan, the package list) go through the anon key;
    // the service role has no table grants.
    const anon = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_ANON_KEY')!,
        {
            auth: { persistSession: false },
        },
    )
    const admin = adminClient()
    const plan = await anon.rpc('my_plan')
    if (plan.error) return json({ error: plan.error.message }, 500)
    const free =
        Number(
            (plan.data as { limits?: { builder?: number } }).limits?.builder ??
                0,
        ) > 0

    let watermark = 'free'
    let user: string | null = null
    let device: string | null = null
    if (!free) {
        const claims = body.license ? readOwnLicense(body.license) : null
        if (!claims) return json({ error: 'license_required' }, 401)
        const state = await licenseState(admin, claims.sub, claims.dev)
        if (!state.entitled || !state.device_active)
            return json({ error: 'license_revoked' }, 403)
        const allowed = await admin.rpc('package_download_allowed', {
            p_user: claims.sub,
        })
        if (allowed.error) return json({ error: allowed.error.message }, 500)
        if (!allowed.data) return json({ error: 'rate_limited' }, 429)
        user = claims.sub
        device = claims.dev
        watermark = await watermarkFor(claims.sub)
    }

    let query = anon
        .from('builder_packages')
        .select('version, storage_prefix')
        .eq('channel', 'stable')
        .eq('host_api', `^${body.hostApi}`)
        .order('published_at', { ascending: false })
        .limit(1)
    if (body.version) query = query.eq('version', body.version)
    const { data: rows, error: listError } = await query
    if (listError) return json({ error: listError.message }, 500)
    const row = rows?.[0]
    if (!row) return json({ error: 'no_package' }, 404)

    const read = async (file: string): Promise<Uint8Array> => {
        const { data, error } = await admin.storage
            .from('packages')
            .download(row.storage_prefix + file)
        if (error || !data)
            throw new Error(`${file}: ${error?.message ?? 'missing'}`)
        return new Uint8Array(await data.arrayBuffer())
    }
    const stored = JSON.parse(
        new TextDecoder().decode(await read('manifest.json')),
    ) as StoredManifest

    const files: Record<string, string> = {}
    const listed: StoredManifest['files'] = []
    for (const f of stored.files) {
        let bytes = await read(f.path)
        if (f.path.endsWith('.mjs'))
            bytes = enc.encode(
                new TextDecoder()
                    .decode(bytes)
                    .replaceAll(PLACEHOLDER, watermark),
            )
        files[f.path] = encodeBase64(bytes)
        listed.push({
            path: f.path,
            sha256: await sha256Hex(bytes),
            bytes: bytes.length,
        })
    }
    const manifest = JSON.stringify({
        name: stored.name,
        version: stored.version,
        hostApi: stored.hostApi,
        hostModules: stored.hostModules,
        files: listed,
        licensee: watermark,
        issuedAt: Math.floor(Date.now() / 1000),
    })

    if (user) {
        const logged = await admin.rpc('log_package_download', {
            p_entry: {
                user_id: user,
                device_pub_hash: device,
                version: stored.version,
                watermark,
            },
        })
        if (logged.error) return json({ error: logged.error.message }, 500)
    }
    return json({ manifest, ...signManifest(manifest), files })
})
