// pattern-check: skip — one-shot CLI: make one environment's signing keys.
//
//   node scripts/gen-signing-keys.mjs <staging|production>
//
// Writes the private halves to supabase/secrets.<env>.env (gitignored) for
//   supabase secrets set --project-ref <ref> --env-file supabase/secrets.<env>.env
// and pins the public halves in the app (license keys.ts, builderPackage.ts),
// which must ship in a release before the server signs with them. Refuses to
// overwrite an existing secrets file: losing it means rotating the keys.
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { randomBytes } from 'node:crypto'
import { join } from 'node:path'
import { ed25519 } from '@noble/curves/ed25519.js'

const env = process.argv[2]
if (!['staging', 'production'].includes(env)) {
    console.error('usage: gen-signing-keys.mjs <staging|production>')
    process.exit(2)
}
const root = new URL('..', import.meta.url).pathname
const out = join(root, 'supabase', `secrets.${env}.env`)
if (existsSync(out)) {
    console.error(`${out} exists; delete it only if you mean to rotate.`)
    process.exit(1)
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

writeFileSync(
    out,
    [
        `LICENSE_SIGNING_KEY=${lic.secret}`,
        `LICENSE_SIGNING_KID=${licKid}`,
        `PACKAGE_SIGNING_KEY=${pkg.secret}`,
        `PACKAGE_SIGNING_KID=${pkgKid}`,
        `WATERMARK_KEY=${hex(randomBytes(32))}`,
        '',
    ].join('\n'),
    { mode: 0o600 },
)

/** Add `'kid': 'public'` as the first entry of the named map in a file. */
function pin(file, map, kid, publicKey) {
    const path = join(root, file)
    const text = readFileSync(path, 'utf8')
    const head = `const ${map}: Readonly<Record<string, string>> = {\n`
    if (!text.includes(head)) throw new Error(`${map} not found in ${file}`)
    const entry = `    '${kid}':\n        '${publicKey}',\n`
    writeFileSync(path, text.replace(head, head + entry))
}
pin(
    'src/renderer/src/lib/license/keys.ts',
    'PRODUCTION_KEYS',
    licKid,
    lic.public,
)
pin(
    'src/shared/builderPackage.ts',
    'PRODUCTION_PACKAGE_KEYS',
    pkgKid,
    pkg.public,
)

console.log(`Wrote ${out}`)
console.log(`Pinned ${licKid} and ${pkgKid} in the app.`)
