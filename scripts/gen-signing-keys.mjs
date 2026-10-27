// pattern-check: skip — one-shot CLI: make one environment's signing keys.
//
//   node scripts/gen-signing-keys.mjs <staging|production> <project-ref>
//
// Generates the license and package Ed25519 key pairs and the watermark key in
// memory and hands them straight to `supabase secrets set` for that project.
// The private keys are never written to disk or printed, and Supabase does not
// show them again, so nobody holding repo files or variables can sign
// licenses. Where the public halves go:
// - production: pinned in the app (license keys.ts, builderPackage.ts);
//   commit them and ship that release.
// - staging: not in the code. They go to DEV_SIGNING_PUBLIC_KEYS in
//   .env.local for local runs, and the script prints the value for the GitHub
//   variable SIGNING_PUBLIC_KEYS_STAGING (dev.remappr.com, previews).
//
// First setup only: it refuses when the project already has signing keys,
// because replacing them breaks every app that does not pin the new ones yet.
// Rotation: pin the new public key in a release first (see supabase/README.md).
import { execFileSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { ed25519 } from '@noble/curves/ed25519.js'

const [env, ref] = process.argv.slice(2)
if (
    !['staging', 'production'].includes(env) ||
    !/^[a-z0-9]{20}$/.test(ref ?? '')
) {
    console.error(
        'usage: gen-signing-keys.mjs <staging|production> <project-ref>',
    )
    process.exit(2)
}
const root = new URL('..', import.meta.url).pathname
const supabase = join(root, 'node_modules', '.bin', 'supabase')

const existing = execFileSync(
    supabase,
    ['secrets', 'list', '--project-ref', ref],
    {
        encoding: 'utf8',
    },
)
if (/\bLICENSE_SIGNING_KEY\b/.test(existing)) {
    console.error(`${ref} already has signing keys; refusing to replace them.`)
    process.exit(1)
}

/** Where a public key goes; checked before the project is touched, so a
 *  failure here leaves nothing half done. */
function pinTarget(file, map, kid) {
    const path = join(root, file)
    const decl = `const ${map}: Readonly<Record<string, string>> = {`
    // An empty map is formatted as `= {}`; open it up first.
    const text = readFileSync(path, 'utf8').replace(`${decl}}`, `${decl}\n}`)
    const head = `${decl}\n`
    if (!text.includes(head)) throw new Error(`${map} not found in ${file}`)
    if (text.includes(`'${kid}'`))
        throw new Error(`${kid} is already pinned in ${file}`)
    return {
        path,
        kid,
        pinned: (publicKey) =>
            text.replace(
                head,
                `${head}    '${kid}':\n        '${publicKey}',\n`,
            ),
    }
}

const hex = (b) => Buffer.from(b).toString('hex')
const pair = () => {
    const secret = ed25519.utils.randomSecretKey()
    return { secret: hex(secret), public: hex(ed25519.getPublicKey(secret)) }
}
const lic = pair()
const pkg = pair()
const licKid = `lic-${env}-1`
const pkgKid = `pkg-${env}-1`
// Production pins its keys in the code; staging's live in env (see keys.ts).
const pins =
    env === 'production'
        ? [
              pinTarget(
                  'src/renderer/src/lib/license/keys.ts',
                  'PRODUCTION_KEYS',
                  licKid,
              ),
              pinTarget(
                  'src/shared/builderPackage.ts',
                  'PRODUCTION_PACKAGE_KEYS',
                  pkgKid,
              ),
          ]
        : []
const envFile = join(root, '.env.local')
const ENV_LINE = /^DEV_SIGNING_PUBLIC_KEYS=.*$/m
if (env === 'staging' && ENV_LINE.test(readEnvFile()))
    throw new Error('.env.local already has DEV_SIGNING_PUBLIC_KEYS')

function readEnvFile() {
    try {
        return readFileSync(envFile, 'utf8')
    } catch {
        return ''
    }
}

// Arguments, not a file: nothing lands on disk. They are visible only to this
// user's processes for the moment the CLI runs.
execFileSync(
    supabase,
    [
        'secrets',
        'set',
        '--project-ref',
        ref,
        `LICENSE_SIGNING_KEY=${lic.secret}`,
        `LICENSE_SIGNING_KID=${licKid}`,
        `PACKAGE_SIGNING_KEY=${pkg.secret}`,
        `PACKAGE_SIGNING_KID=${pkgKid}`,
        `WATERMARK_KEY=${hex(randomBytes(32))}`,
    ],
    { stdio: ['ignore', 'ignore', 'inherit'] },
)

for (const p of pins)
    writeFileSync(p.path, p.pinned(p.kid === licKid ? lic.public : pkg.public))

if (env === 'production') {
    console.log(
        `Signing keys set on ${ref}; ${licKid} and ${pkgKid} pinned in the app.`,
    )
    console.log('Commit keys.ts and builderPackage.ts, then ship that release.')
} else {
    // Public halves only: safe to print and to store as a plain variable.
    const value = `${licKid}:${lic.public},${pkgKid}:${pkg.public}`
    const current = readEnvFile()
    writeFileSync(
        envFile,
        `${current.replace(/\n*$/, '\n')}DEV_SIGNING_PUBLIC_KEYS=${value}\n`,
        { mode: 0o600 },
    )
    console.log(`Signing keys set on ${ref}; public keys saved in .env.local.`)
    console.log(
        'Set the GitHub variable SIGNING_PUBLIC_KEYS_STAGING (environment "remappr") to:',
    )
    console.log(value)
}
