#!/usr/bin/env node
/*
 * Publish a built builder package to a Supabase project: upload its files to
 * the private `packages` bucket (builder/<version>/…) and register it in
 * builder_packages. Local by default (reads the local stack's URL and service
 * key from `supabase status`); for another project set SUPABASE_URL and
 * SUPABASE_SERVICE_ROLE_KEY. CI does the same in the builder repo (P11).
 *
 *   node scripts/publish-builder-package.cjs [path/to/dist-package/builder/<version>]
 */
const fs = require('node:fs')
const path = require('node:path')
const { execFileSync } = require('node:child_process')
const { createClient } = require('@supabase/supabase-js')

const appRoot = path.resolve(__dirname, '..')

function localEnv() {
    const out = execFileSync(
        'pnpm',
        ['exec', 'supabase', 'status', '-o', 'env'],
        {
            cwd: appRoot,
            encoding: 'utf8',
        },
    )
    const env = Object.fromEntries(
        out
            .split('\n')
            .map((l) => /^([A-Z_]+)="?([^"]*)"?$/.exec(l))
            .filter(Boolean)
            .map((m) => [m[1], m[2]]),
    )
    return { url: env.API_URL, key: env.SERVICE_ROLE_KEY }
}

function newestBuilt() {
    const root = path.resolve(
        appRoot,
        '..',
        '..',
        'Remappr',
        'remapprBuilder',
        'dist-package',
        'builder',
    )
    const versions = fs
        .readdirSync(root)
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    return path.join(root, versions[versions.length - 1])
}

async function main() {
    const dir = path.resolve(process.argv[2] ?? newestBuilt())
    const manifest = JSON.parse(
        fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'),
    )
    const { url, key } = process.env.SUPABASE_URL
        ? {
              url: process.env.SUPABASE_URL,
              key: process.env.SUPABASE_SERVICE_ROLE_KEY,
          }
        : localEnv()
    const admin = createClient(url, key, { auth: { persistSession: false } })
    const prefix = `builder/${manifest.version}/`
    for (const file of [
        'manifest.json',
        ...manifest.files.map((f) => f.path),
    ]) {
        const { error } = await admin.storage
            .from('packages')
            .upload(prefix + file, fs.readFileSync(path.join(dir, file)), {
                upsert: true,
                contentType: 'application/octet-stream',
            })
        if (error) throw error
    }
    const { error } = await admin.rpc('register_builder_package', {
        p_pkg: {
            version: manifest.version,
            host_api: manifest.hostApi,
            storage_prefix: prefix,
            files: manifest.files,
        },
    })
    if (error) throw error
    console.log(
        `Published builder ${manifest.version} → ${url} packages/${prefix}`,
    )
}

main().catch((e) => {
    console.error(e)
    process.exit(1)
})
