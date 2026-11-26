// pattern-check: skip — unit tests for the desktop package cache
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => ({
    app: {},
    ipcMain: { handle: vi.fn() },
    protocol: {},
}))

import {
    checkPackagePayload,
    createPackageCache,
    installSeed,
    PACKAGE_LIMITS,
    parsePackageUrl,
} from './builder-packages'

const SAMPLE = process.env.REMAPPR_PKG_SAMPLE

describe('parsePackageUrl', () => {
    it('accepts builder/<version>/<file> only', () => {
        expect(
            parsePackageUrl('remappr-pkg://builder/1.2.3/index.mjs'),
        ).toEqual({ version: '1.2.3', file: 'index.mjs' })
        expect(parsePackageUrl('remappr-pkg://builder/1.2.3/../x')).toBeNull()
        expect(parsePackageUrl('remappr-pkg://builder/1.2.3/a/b.js')).toBeNull()
        expect(
            parsePackageUrl('remappr-pkg://other/1.2.3/index.mjs'),
        ).toBeNull()
        expect(
            parsePackageUrl('remappr-pkg://builder/latest/index.mjs'),
        ).toBeNull()
        expect(parsePackageUrl('https://builder/1.2.3/index.mjs')).toBeNull()
    })
})

describe('checkPackagePayload', () => {
    const signed = { manifest: '{}', signature: '', kid: 'dev' }
    const b64 = (bytes: number): string => 'A'.repeat(Math.ceil(bytes / 3) * 4)

    it('takes a payload within the limits', () => {
        expect(() =>
            checkPackagePayload(signed, { 'index.mjs': b64(1024) }),
        ).not.toThrow()
    })

    it('refuses too many files, a big file, a big total, a big manifest', () => {
        const many = Object.fromEntries(
            Array.from({ length: PACKAGE_LIMITS.files + 1 }, (_, i) => [
                `f${i}.js`,
                '',
            ]),
        )
        expect(() => checkPackagePayload(signed, many)).toThrow(/too many/)
        expect(() =>
            checkPackagePayload(signed, {
                'a.js': b64(PACKAGE_LIMITS.fileBytes + 3),
            }),
        ).toThrow(/file too large/)
        const half = b64(PACKAGE_LIMITS.fileBytes - 3)
        const big = Object.fromEntries(
            Array.from({ length: 5 }, (_, i) => [`f${i}.js`, half]),
        )
        expect(() => checkPackagePayload(signed, big)).toThrow(
            /package too large/,
        )
        expect(() =>
            checkPackagePayload(
                {
                    ...signed,
                    manifest: 'x'.repeat(PACKAGE_LIMITS.manifestChars + 1),
                },
                {},
            ),
        ).toThrow(/manifest too large/)
    })

    it('refuses a non-string file or a missing manifest', () => {
        expect(() =>
            checkPackagePayload(signed, {
                'a.js': 1 as unknown as string,
            }),
        ).toThrow(/base64/)
        expect(() => checkPackagePayload({} as typeof signed, {})).toThrow(
            /manifest missing/,
        )
    })
})

describe.skipIf(!SAMPLE)('package cache', () => {
    let root = ''
    afterEach(() => rmSync(root, { recursive: true, force: true }))

    it('stores a verified package, serves it, refuses a changed file', async () => {
        root = mkdtempSync(join(tmpdir(), 'remappr-pkg-'))
        const reply = JSON.parse(readFileSync(SAMPLE!, 'utf8'))
        const cache = createPackageCache(root, true)
        const stored = await cache.store(reply, reply.files)
        expect(await cache.list()).toEqual([stored])

        const url = `remappr-pkg://builder/${stored.version}/index.mjs`
        const ok = await cache.serve(url)
        expect(ok.status).toBe(200)
        expect(ok.headers.get('Content-Type')).toBe('text/javascript')

        writeFileSync(join(root, stored.version, 'index.mjs'), 'tampered')
        expect((await cache.serve(url)).status).toBe(403)
        expect(
            (
                await cache.serve(
                    `remappr-pkg://builder/${stored.version}/nope.js`,
                )
            ).status,
        ).toBe(404)

        // Production hosts do not trust the dev key.
        expect(await createPackageCache(root, false).list()).toEqual([])
        await expect(
            createPackageCache(root, false).store(reply, reply.files),
        ).rejects.toThrow(/signature/)
    })

    it('refuses a package whose file does not match', async () => {
        root = mkdtempSync(join(tmpdir(), 'remappr-pkg-'))
        const reply = JSON.parse(readFileSync(SAMPLE!, 'utf8'))
        const cache = createPackageCache(root, true)
        await expect(
            cache.store(reply, { ...reply.files, 'style.css': btoa('x') }),
        ).rejects.toThrow(/does not match/)
        expect(await cache.list()).toEqual([])
    })

    it('installs the seed into an empty cache only', async () => {
        root = mkdtempSync(join(tmpdir(), 'remappr-pkg-'))
        const cache = createPackageCache(root, true)
        writeFileSync(join(root, 'seed.json'), readFileSync(SAMPLE!))
        expect(await installSeed(cache, join(root, 'seed.json'))).toBe(true)
        expect(await cache.list()).toHaveLength(1)
        expect(await installSeed(cache, join(root, 'seed.json'))).toBe(false)
        expect(
            await installSeed(
                createPackageCache(join(root, 'none'), true),
                join(root, 'missing.json'),
            ),
        ).toBe(false)
    })
})
