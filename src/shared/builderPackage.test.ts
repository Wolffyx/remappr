// pattern-check: skip — unit tests for signed package verification
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
    compareVersions,
    fileMatches,
    verifySignedManifest,
    type PackageSignature,
} from './builderPackage'

// A real get-package reply captured from the local stack (dev key).
const SCRATCH = process.env.REMAPPR_PKG_SAMPLE

describe('builder package verification', () => {
    it('orders versions numerically', () => {
        expect(compareVersions('1.2.10', '1.2.9')).toBeGreaterThan(0)
        expect(compareVersions('1.0.0', '1.0.0')).toBe(0)
        expect(compareVersions('0.9.9', '1.0.0')).toBeLessThan(0)
    })

    it('refuses unknown keys and malformed signatures', () => {
        const signed: PackageSignature = {
            manifest: '{}',
            signature: 'AAAA',
            kid: 'pkg-dev-1',
        }
        expect(verifySignedManifest(signed, true)).toBeNull()
        expect(
            verifySignedManifest({ ...signed, kid: 'nope' }, true),
        ).toBeNull()
    })

    it.skipIf(!SCRATCH)(
        'verifies a real reply and its files; dev keys only in dev',
        async () => {
            const reply = JSON.parse(
                readFileSync(SCRATCH!, 'utf8'),
            ) as PackageSignature & { files: Record<string, string> }
            const manifest = verifySignedManifest(reply, true)
            expect(manifest?.licensee).toBe('free')
            expect(verifySignedManifest(reply, false)).toBeNull()
            const tampered = {
                ...reply,
                manifest: reply.manifest.replace('"free"', '"mine"'),
            }
            expect(verifySignedManifest(tampered, true)).toBeNull()
            for (const f of manifest!.files) {
                const bytes = Buffer.from(reply.files[f.path], 'base64')
                expect(await fileMatches(f, bytes)).toBe(true)
                bytes[0] ^= 1
                expect(await fileMatches(f, bytes)).toBe(false)
            }
        },
    )
})
