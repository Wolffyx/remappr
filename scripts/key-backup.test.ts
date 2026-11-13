// pattern-check: skip — unit tests for the encrypted signing-key backup
import { mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
    backupDir,
    cleanInput,
    decryptBackup,
    encryptBackup,
    writeBackup,
} from './key-backup.mjs'

const PASS = 'correct horse battery staple'
const input = {
    env: 'production',
    ref: 'abcdefghijklmnopqrst',
    publicKeys: { 'lic-production-1': 'ab'.repeat(32) },
    secrets: { LICENSE_SIGNING_KEY: 'cd'.repeat(32), WATERMARK_KEY: 'ef' },
}

describe('signing-key backup', () => {
    let dir = ''
    afterEach(() => dir && rmSync(dir, { recursive: true, force: true }))

    it('round-trips under the right passphrase only', () => {
        const sealed = encryptBackup(input, PASS)
        expect(JSON.stringify(sealed)).not.toContain('cd'.repeat(32))
        expect(decryptBackup(sealed, PASS)).toEqual(input.secrets)
        expect(() => decryptBackup(sealed, `${PASS}!`)).toThrow(/passphrase/)
    })

    it('refuses a changed file, header or data', () => {
        const sealed = encryptBackup(input, PASS)
        expect(() =>
            decryptBackup({ ...sealed, ref: 'zzzzzzzzzzzzzzzzzzzz' }, PASS),
        ).toThrow()
        const data = Buffer.from(sealed.data, 'base64')
        data[0] ^= 1
        expect(() =>
            decryptBackup({ ...sealed, data: data.toString('base64') }, PASS),
        ).toThrow()
    })

    it('needs a long passphrase', () => {
        expect(() => encryptBackup(input, 'short')).toThrow(/16/)
    })

    it('writes owner-only files and never overwrites one', () => {
        dir = mkdtempSync(join(tmpdir(), 'remappr-backup-'))
        const sealed = encryptBackup(input, PASS)
        const file = writeBackup(join(dir, 'keys'), sealed)
        expect(statSync(file).mode & 0o777).toBe(0o600)
        expect(statSync(join(dir, 'keys')).mode & 0o777).toBe(0o700)
        expect(JSON.parse(readFileSync(file, 'utf8')).format).toBe(
            'remappr.signing-keys-backup',
        )
        expect(() => writeBackup(join(dir, 'keys'), sealed)).toThrow()
    })

    it('keeps backups out of the repository', () => {
        const repo = join(homedir(), 'some-repo')
        expect(() => backupDir(repo, repo)).toThrow(/inside the repository/)
        expect(() => backupDir(repo, join(repo, 'backups'))).toThrow()
        expect(backupDir(repo, join(repo, '..', 'key-backups'))).toBe(
            join(homedir(), 'key-backups'),
        )
        expect(backupDir(repo)).toBe(join(homedir(), 'remappr-key-backups'))
    })

    it('keeps a pasted passphrase exactly, without terminal markers', () => {
        expect(cleanInput('\u001b[200~ab cd!\u001b[201~')).toBe('ab cd!')
        expect(cleanInput('pass\u001b[Dword')).toBe('password')
        expect(cleanInput('  spaces kept  ')).toBe('  spaces kept  ')
    })
})
