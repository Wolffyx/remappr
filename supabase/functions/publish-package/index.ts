// pattern-check: skip — one request handler: verify the release workflow's
// token, check the upload against its manifest, store it, register it.
//
// POST from the builder repo's release workflow (plan §6c B, P11), with its
// GitHub Actions OIDC token as the bearer — no Supabase key lives in that
// repo. Body: { manifest: <manifest.json text>, files: {path: base64},
// changelog? }. The branch that ran the workflow picks the channel (main →
// stable, dev → beta). A version is immutable: publishing it again with the
// same files is a no-op (or promotes beta → stable), with other files a 409.
import { decodeBase64 } from 'jsr:@std/encoding@1/base64'
import { createClient } from 'npm:@supabase/supabase-js@2.118.0'
import { createRemoteJWKSet, jwtVerify } from 'npm:jose@6.2.13'
import { adminClient, json, preflight } from '../_shared/http.ts'
import { sha256Hex } from '../_shared/license.ts'
import {
    type Channel,
    checkPackage,
    GITHUB_ISSUER,
    type ManifestFile,
    PUBLISH_AUDIENCE,
    publishChannel,
    sameFiles,
} from '../_shared/publish.ts'

const JWKS = createRemoteJWKSet(new URL(`${GITHUB_ISSUER}/.well-known/jwks`))
const MAX_CHANGELOG = 20000

interface PublishBody {
    manifest?: unknown
    files?: unknown
    changelog?: unknown
}

/** The channel the caller's OIDC token may publish to, or null. */
async function callerChannel(req: Request): Promise<Channel | null> {
    const token = req.headers.get('Authorization')?.replace(/^Bearer /i, '')
    if (!token) return null
    try {
        const { payload } = await jwtVerify(token, JWKS, {
            issuer: GITHUB_ISSUER,
            audience: PUBLISH_AUDIENCE,
            algorithms: ['RS256'],
        })
        return publishChannel(payload)
    } catch {
        // Bad signature, wrong issuer/audience, expired: not the workflow.
        return null
    }
}

function decodeFiles(files: unknown): Record<string, Uint8Array> | null {
    if (!files || typeof files !== 'object') return null
    const out: Record<string, Uint8Array> = {}
    for (const [path, b64] of Object.entries(files)) {
        if (typeof b64 !== 'string') return null
        out[path] = decodeBase64(b64)
    }
    return out
}

Deno.serve(async (req) => {
    const early = preflight(req)
    if (early) return early
    if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

    const channel = await callerChannel(req)
    if (!channel) return json({ error: 'not_the_release_workflow' }, 401)

    const body = (await req.json().catch(() => ({}))) as PublishBody
    const files = decodeFiles(body.files)
    if (typeof body.manifest !== 'string' || !files)
        return json({ error: 'bad_request' }, 400)
    const checked = await checkPackage(body.manifest, files, sha256Hex)
    if ('error' in checked) return json({ error: checked.error }, 422)
    const { manifest } = checked
    const changelog =
        typeof body.changelog === 'string'
            ? body.changelog.slice(0, MAX_CHANGELOG)
            : ''

    // The package list is a public read (as in get-package); writes go
    // through the bucket and register_builder_package (service role).
    const anon = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_ANON_KEY')!,
        { auth: { persistSession: false } },
    )
    const admin = adminClient()
    const existing = await anon
        .from('builder_packages')
        .select('files, channel')
        .eq('version', manifest.version)
        .maybeSingle()
    if (existing.error) return json({ error: existing.error.message }, 500)
    if (existing.data) {
        const same = sameFiles(
            existing.data.files as ManifestFile[],
            manifest.files,
        )
        if (!same) return json({ error: 'version_exists' }, 409)
        // Same package again: a re-run, or a beta promoted to stable.
        if (existing.data.channel === channel || channel === 'beta')
            return json({
                version: manifest.version,
                channel: existing.data.channel,
                unchanged: true,
            })
    }

    const prefix = `builder/${manifest.version}/`
    const uploads: [string, Uint8Array][] = [
        ['manifest.json', new TextEncoder().encode(body.manifest)],
        ...manifest.files.map((f): [string, Uint8Array] => [
            f.path,
            files[f.path],
        ]),
    ]
    for (const [path, bytes] of uploads) {
        const { error } = await admin.storage
            .from('packages')
            .upload(prefix + path, bytes, {
                upsert: true,
                contentType: 'application/octet-stream',
            })
        if (error) return json({ error: `${path}: ${error.message}` }, 500)
    }
    const registered = await admin.rpc('register_builder_package', {
        p_pkg: {
            version: manifest.version,
            host_api: manifest.hostApi,
            storage_prefix: prefix,
            files: manifest.files,
            channel,
            changelog,
        },
    })
    if (registered.error) return json({ error: registered.error.message }, 500)
    return json({ version: manifest.version, channel })
})
