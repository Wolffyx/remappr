// pattern-check: skip — one-shot CLI: make one environment's signing keys.
//
//   node scripts/gen-signing-keys.mjs <staging|production> <project-ref>
//        [--replace] [--backup-dir <dir>]
//
// Generates the license and package Ed25519 key pairs and the watermark key in
// memory, writes an encrypted backup of them (a passphrase you type, never
// stored; see scripts/key-backup.mjs) outside the repository, then hands them
// to `supabase secrets set` for that project. The backup is written first: a
// project never gets keys that have no backup. Nothing else holds the private
// keys, and Supabase does not show them again. Where the public halves go:
// - production: pinned in the app (license keys.ts, builderPackage.ts);
//   commit them and ship that release.
// - staging: not in the code. They go to DEV_SIGNING_PUBLIC_KEYS in
//   .env.local for local runs, and the script prints the value for the GitHub
//   variable SIGNING_PUBLIC_KEYS_STAGING (dev.remappr.com, previews).
//
// It refuses a project that already has signing keys unless --replace:
// replacing them breaks every license signed so far whose app does not pin the
// new key yet, so only replace keys that never signed a license (or rotate,
// see supabase/README.md). The backup folder defaults to ~/remappr-key-backups;
// a folder inside the repository is refused.
import { execFileSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { ed25519 } from '@noble/curves/ed25519.js'
import {
    askPassphrase,
    backupDir,
    DEFAULT_BACKUP_DIR,
    encryptBackup,
    writeBackup,
} from './key-backup.mjs'

const args = process.argv.slice(2)
const dirAt = args.indexOf('--backup-dir')
const dirArg = dirAt >= 0 ? args[dirAt + 1] : undefined
const [env, ref] = args.filter(
    (a, i) => !a.startsWith('--') && (dirAt < 0 || i !== dirAt + 1),
)
const replace = args.includes('--replace')
if (
    !['staging', 'production'].includes(env) ||
    !/^[a-z0-9]{20}$/.test(ref ?? '') ||
    (dirAt >= 0 && !dirArg)
) {
    console.error(
        'usage: gen-signing-keys.mjs <staging|production> <project-ref> [--replace] [--backup-dir <dir>]',
    )
    process.exit(2)
}
const root = new URL('..', import.meta.url).pathname
const supabase = join(root, 'node_modules', '.bin', 'supabase')
const dir = backupDir(root, dirArg ?? DEFAULT_BACKUP_DIR)

const existing = execFileSync(
    supabase,
    ['secrets', 'list', '--project-ref', ref],
    { encoding: 'utf8' },
)
if (/\bLICENSE_SIGNING_KEY\b/.test(existing) && !replace) {
    console.error(
        `${ref} already has signing keys; refusing to replace them (--replace).`,
    )
    process.exit(1)
}

const licKid = `lic-${env}-1`
const pkgKid = `pkg-${env}-1`

/** Where a production public key goes; checked before the project is
 *  touched, so a failure here leaves nothing half done. */
function pinTarget(file, map, kid) {
    const path = join(root, file)
    const decl = `const ${map}: Readonly<Record<string, string>> = {`
    // An empty map is formatted as `= {}`; open it up first.
    let text = readFileSync(path, 'utf8').replace(`${decl}}`, `${decl}\n}`)
    const head = `${decl}\n`
    if (!text.includes(head)) throw new Error(`${map} not found in ${file}`)
    const entry = new RegExp(`    '${kid}':\\n        '[0-9a-f]{64}',\\n`)
    if (entry.test(text)) {
        if (!replace) throw new Error(`${kid} is already pinned in ${file}`)
        text = text.replace(entry, '')
    }
    return {
        write: (publicKey) =>
            writeFileSync(
                path,
                text.replace(
                    head,
                    `${head}    '${kid}':\n        '${publicKey}',\n`,
                ),
            ),
    }
}

const envFile = join(root, '.env.local')
const ENV_LINE = /^DEV_SIGNING_PUBLIC_KEYS=.*\n?/m
function readEnvFile() {
    try {
        return readFileSync(envFile, 'utf8')
    } catch {
        return ''
    }
}

const pins =
    env === 'production'
        ? {
              lic: pinTarget(
                  'src/renderer/src/lib/license/keys.ts',
                  'PRODUCTION_KEYS',
                  licKid,
              ),
              pkg: pinTarget(
                  'src/shared/builderPackage.ts',
                  'PRODUCTION_PACKAGE_KEYS',
                  pkgKid,
              ),
          }
        : null
if (env === 'staging' && ENV_LINE.test(readEnvFile()) && !replace)
    throw new Error(
        '.env.local already has DEV_SIGNING_PUBLIC_KEYS (--replace)',
    )

const hex = (b) => Buffer.from(b).toString('hex')
const pair = () => {
    const secret = ed25519.utils.randomSecretKey()
    return { secret: hex(secret), public: hex(ed25519.getPublicKey(secret)) }
}
const lic = pair()
const pkg = pair()
const secrets = {
    LICENSE_SIGNING_KEY: lic.secret,
    LICENSE_SIGNING_KID: licKid,
    PACKAGE_SIGNING_KEY: pkg.secret,
    PACKAGE_SIGNING_KID: pkgKid,
    WATERMARK_KEY: hex(randomBytes(32)),
}
const publicKeys = { [licKid]: lic.public, [pkgKid]: pkg.public }

// 1. The encrypted backup, before anything else changes.
console.log(
    `A backup of these keys goes to ${dir}, encrypted with a passphrase.`,
)
console.log(
    'Use a long one (5+ random words) and keep it in your password manager.',
)
const passphrase = await askPassphrase('Backup passphrase: ', { confirm: true })
const file = writeBackup(
    dir,
    encryptBackup({ env, ref, publicKeys, secrets }, passphrase),
)
console.log(`Backup written: ${file}`)

// 2. The project's secrets. Arguments, not a file: visible only to this
// user's processes for the moment the CLI runs.
execFileSync(
    supabase,
    [
        'secrets',
        'set',
        '--project-ref',
        ref,
        ...Object.entries(secrets).map(([k, v]) => `${k}=${v}`),
    ],
    { stdio: ['ignore', 'ignore', 'inherit'] },
)

// 3. The public halves.
if (pins) {
    pins.lic.write(lic.public)
    pins.pkg.write(pkg.public)
    console.log(
        `Signing keys set on ${ref}; ${licKid} and ${pkgKid} pinned in the app.`,
    )
    console.log('Commit keys.ts and builderPackage.ts, then ship that release.')
} else {
    // Public halves only: safe to print and to store as a plain variable.
    const value = `${licKid}:${lic.public},${pkgKid}:${pkg.public}`
    const current = readEnvFile().replace(ENV_LINE, '')
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
console.log(
    'Now copy the backup file to your password manager or an offline drive.',
)
