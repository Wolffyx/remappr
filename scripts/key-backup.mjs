// pattern-check: skip — passphrase encryption helpers for the signing-key backup.
//
// An offline backup of one project's signing secrets, encrypted with a
// passphrase only its owner knows: scrypt (N=2^17, r=8, p=1) derives the key,
// AES-256-GCM encrypts and authenticates. Node built-ins only. The file is
// JSON with the public keys in the clear (to tell backups apart) and the
// secrets sealed. Backups live outside the repository (~/remappr-key-backups
// by default) and should go on to a password manager or an offline drive.
import {
    createCipheriv,
    createDecipheriv,
    randomBytes,
    scryptSync,
} from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, relative, resolve, isAbsolute } from 'node:path'

const FORMAT = 'remappr.signing-keys-backup'
const KDF = { N: 2 ** 17, r: 8, p: 1, keylen: 32 }
const MIN_PASSPHRASE = 16

export const DEFAULT_BACKUP_DIR = join(homedir(), 'remappr-key-backups')

function deriveKey(passphrase, salt, kdf = KDF) {
    return scryptSync(passphrase, salt, kdf.keylen, {
        N: kdf.N,
        r: kdf.r,
        p: kdf.p,
        maxmem: 256 * kdf.N * kdf.r,
    })
}

/** Seal `secrets` (an object of strings) under `passphrase`. */
export function encryptBackup({ env, ref, publicKeys, secrets }, passphrase) {
    if (passphrase.length < MIN_PASSPHRASE)
        throw new Error(
            `the passphrase needs at least ${MIN_PASSPHRASE} characters`,
        )
    const salt = randomBytes(16)
    const iv = randomBytes(12)
    const cipher = createCipheriv(
        'aes-256-gcm',
        deriveKey(passphrase, salt),
        iv,
    )
    const header = { format: FORMAT, v: 1, env, ref, publicKeys }
    // The header is authenticated too: changing it breaks decryption.
    cipher.setAAD(Buffer.from(JSON.stringify(header)))
    const data = Buffer.concat([
        cipher.update(JSON.stringify(secrets), 'utf8'),
        cipher.final(),
    ])
    return {
        ...header,
        createdAt: new Date().toISOString(),
        kdf: { name: 'scrypt', ...KDF, salt: salt.toString('base64') },
        cipher: 'aes-256-gcm',
        iv: iv.toString('base64'),
        tag: cipher.getAuthTag().toString('base64'),
        data: data.toString('base64'),
    }
}

/** The secrets of a backup; throws on a wrong passphrase or a changed file. */
export function decryptBackup(backup, passphrase) {
    if (backup?.format !== FORMAT || backup.v !== 1)
        throw new Error('not a Remappr signing-key backup')
    const { env, ref, publicKeys } = backup
    const header = { format: FORMAT, v: 1, env, ref, publicKeys }
    const decipher = createDecipheriv(
        'aes-256-gcm',
        deriveKey(
            passphrase,
            Buffer.from(backup.kdf.salt, 'base64'),
            backup.kdf,
        ),
        Buffer.from(backup.iv, 'base64'),
    )
    decipher.setAAD(Buffer.from(JSON.stringify(header)))
    decipher.setAuthTag(Buffer.from(backup.tag, 'base64'))
    try {
        const plain = Buffer.concat([
            decipher.update(Buffer.from(backup.data, 'base64')),
            decipher.final(),
        ])
        return JSON.parse(plain.toString('utf8'))
    } catch {
        throw new Error('wrong passphrase, or the backup file was changed')
    }
}

/** The backup folder; refused when it lies inside the repository. */
export function backupDir(repoRoot, wanted = DEFAULT_BACKUP_DIR) {
    const dir = resolve(wanted)
    const rel = relative(resolve(repoRoot), dir)
    if (rel === '' || (!rel.startsWith('..') && !isAbsolute(rel)))
        throw new Error(
            `${dir} is inside the repository; keep key backups outside it`,
        )
    return dir
}

/** Write a sealed backup (folder 700, file 600); returns its path. */
export function writeBackup(dir, backup) {
    mkdirSync(dir, { recursive: true, mode: 0o700 })
    const day = backup.createdAt.slice(0, 10)
    const file = join(
        dir,
        `remappr-signing-keys-${backup.env}-${backup.ref}-${day}.json`,
    )
    writeFileSync(file, JSON.stringify(backup, null, 2) + '\n', {
        mode: 0o600,
        flag: 'wx',
    })
    return file
}

export function readBackup(file) {
    return JSON.parse(readFileSync(file, 'utf8'))
}

/** Ask for a passphrase without echoing it (twice when `confirm`). */
export async function askPassphrase(prompt, { confirm = false } = {}) {
    const first = await readHidden(prompt)
    if (!confirm) return first
    const again = await readHidden('Type or paste it again: ')
    if (again !== first) throw new Error('the passphrases do not match')
    return first
}

// Terminal escape sequences: bracketed-paste markers (ESC[200~ / ESC[201~),
// arrow keys and the like. None belongs in a passphrase.
// eslint-disable-next-line no-control-regex -- matching ESC is the point
const ESCAPES = /\u001b\[[0-9;]*[~A-Za-z]|\u001b./g

/** What was typed or pasted, without escape sequences. Exported for tests. */
export function cleanInput(raw) {
    return raw.replace(ESCAPES, '')
}

/** Read a line without echoing it; typing and pasting both work. Says how
 *  many characters arrived, so a paste can be checked against its source. */
function readHidden(prompt) {
    const { stdin, stdout } = process
    if (!stdin.isTTY)
        throw new Error('run this in a terminal: it asks for a passphrase')
    stdout.write(prompt)
    return new Promise((done, fail) => {
        let text = ''
        stdin.setRawMode(true)
        stdin.resume()
        stdin.setEncoding('utf8')
        const onData = (chunk) => {
            for (const ch of cleanInput(chunk)) {
                if (ch === '\r' || ch === '\n') return finish()
                if (ch === '\u0003') return finish(new Error('cancelled'))
                if (ch === '\u007f' || ch === '\b') text = text.slice(0, -1)
                else text += ch
            }
        }
        const finish = (error) => {
            stdin.off('data', onData)
            stdin.setRawMode(false)
            stdin.pause()
            stdout.write(error ? '\n' : ` (${[...text].length} characters)\n`)
            if (error) fail(error)
            else done(text)
        }
        stdin.on('data', onData)
    })
}
