// pattern-check: skip — one-shot CLI: check or restore a signing-key backup.
//
//   node scripts/signing-keys-backup.mjs verify <backup.json>
//   node scripts/signing-keys-backup.mjs restore <backup.json> <project-ref>
//
// verify: decrypts the backup (asks for its passphrase), checks every private
// key matches the public key recorded with it, and whether those public keys
// are the ones this checkout trusts (pinned for production, .env.local for
// staging). Prints key ids and yes/no answers, never a private value.
// restore: the same checks, then sets the backed-up secrets on the project
// (for a project that lost them, or a replacement project). Asks first.
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createInterface } from 'node:readline/promises'
import { ed25519 } from '@noble/curves/ed25519.js'
import { askPassphrase, decryptBackup, readBackup } from './key-backup.mjs'

const root = new URL('..', import.meta.url).pathname
const [command, file, ref] = process.argv.slice(2)

function fail(message) {
    console.error(message)
    process.exit(1)
}

if (!['verify', 'restore'].includes(command) || !file)
    fail('usage: signing-keys-backup.mjs verify <file> | restore <file> <ref>')
if (command === 'restore' && !/^[a-z0-9]{20}$/.test(ref ?? ''))
    fail('restore needs the project ref to restore into')

const backup = readBackup(file)
console.log(
    `Backup of ${backup.env} keys for ${backup.ref}, made ${backup.createdAt}.`,
)
const secrets = decryptBackup(
    backup,
    await askPassphrase('Backup passphrase: '),
)

const hexPublic = (secretHex) =>
    Buffer.from(ed25519.getPublicKey(Buffer.from(secretHex, 'hex'))).toString(
        'hex',
    )
const pairs = [
    [secrets.LICENSE_SIGNING_KID, secrets.LICENSE_SIGNING_KEY],
    [secrets.PACKAGE_SIGNING_KID, secrets.PACKAGE_SIGNING_KEY],
]
const trusted =
    backup.env === 'production'
        ? readFileSync(
              join(root, 'src/renderer/src/lib/license/keys.ts'),
              'utf8',
          ) + readFileSync(join(root, 'src/shared/builderPackage.ts'), 'utf8')
        : (() => {
              try {
                  return readFileSync(join(root, '.env.local'), 'utf8')
              } catch {
                  return ''
              }
          })()

let sound = Boolean(secrets.WATERMARK_KEY)
for (const [kid, secret] of pairs) {
    const pub = hexPublic(secret)
    const matches = pub === backup.publicKeys[kid]
    const inUse = trusted.includes(pub)
    sound &&= matches
    console.log(
        `${kid}: private key matches its public key: ${matches ? 'yes' : 'NO'}; trusted by this checkout: ${inUse ? 'yes' : 'no'}`,
    )
}
if (!sound) fail('This backup is not usable.')
if (command === 'verify') {
    console.log('The backup is sound.')
    process.exit(0)
}

const rl = createInterface({ input: process.stdin, output: process.stdout })
const answer = await rl.question(
    `Set these ${backup.env} keys on ${ref}, replacing what it has? Type "restore": `,
)
rl.close()
if (answer.trim() !== 'restore') fail('stopped; nothing changed')
execFileSync(
    join(root, 'node_modules', '.bin', 'supabase'),
    [
        'secrets',
        'set',
        '--project-ref',
        ref,
        ...Object.entries(secrets).map(([k, v]) => `${k}=${v}`),
    ],
    { stdio: ['ignore', 'ignore', 'inherit'] },
)
console.log(`Restored the ${backup.env} signing keys on ${ref}.`)
