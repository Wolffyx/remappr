#!/usr/bin/env node
/*
 * Fetch the builder seed for a build: while the builder is free, the newest
 * signed package from get-package is written to public/_seed/builder.json, so
 * the app's very first run has the builder without a download (offline on
 * desktop). Once the builder is paid, get-package refuses anonymous callers and
 * the seed is removed: paid builders come with a license, online, once.
 *
 * Uses VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY from the environment
 * or the repo-root .env.local (the project the build talks to). Without a
 * backend, or when nothing is published yet, it writes no seed and says why.
 */
const fs = require('node:fs')
const path = require('node:path')

const appRoot = path.resolve(__dirname, '..')
const seedFile = path.join(appRoot, 'public', '_seed', 'builder.json')

function readEnvFile(file) {
    if (!fs.existsSync(file)) return {}
    return Object.fromEntries(
        fs
            .readFileSync(file, 'utf8')
            .split('\n')
            .map((l) => /^\s*([A-Z0-9_]+)\s*=\s*"?([^"\n]*)"?\s*$/.exec(l))
            .filter(Boolean)
            .map((m) => [m[1], m[2]]),
    )
}

function hostApi() {
    const src = fs.readFileSync(
        path.join(
            appRoot,
            'src/renderer/src/lib/builderPackage/hostModules.ts',
        ),
        'utf8',
    )
    const m = /export const HOST_API = (\d+)/.exec(src)
    if (!m) throw new Error('HOST_API not found in hostModules.ts')
    return Number(m[1])
}

function removeSeed(reason) {
    fs.rmSync(seedFile, { force: true })
    console.log(`[builder-seed] no seed: ${reason}`)
}

async function main() {
    const env = {
        ...readEnvFile(path.join(appRoot, '.env.local')),
        ...process.env,
    }
    const url = env.VITE_SUPABASE_URL
    const key = env.VITE_SUPABASE_PUBLISHABLE_KEY
    if (!url || !key) return removeSeed('no backend configured for this build')
    const res = await fetch(
        `${url.replace(/\/$/, '')}/functions/v1/get-package`,
        {
            method: 'POST',
            headers: {
                apikey: key,
                Authorization: `Bearer ${key}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ hostApi: hostApi() }),
        },
    )
    const body = await res.json().catch(() => ({}))
    if (res.status === 401)
        return removeSeed('the builder is paid (seeds are for the free stage)')
    if (!res.ok)
        return removeSeed(
            `get-package answered ${res.status} ${body.error ?? ''}`.trim(),
        )
    const licensee = JSON.parse(body.manifest).licensee
    if (licensee !== 'free')
        return removeSeed(`unexpected licensee "${licensee}"`)
    fs.mkdirSync(path.dirname(seedFile), { recursive: true })
    fs.writeFileSync(seedFile, JSON.stringify(body))
    console.log(
        `[builder-seed] builder ${JSON.parse(body.manifest).version} → public/_seed/builder.json`,
    )
}

main().catch((e) => {
    console.error('[builder-seed]', e)
    process.exit(1)
})
