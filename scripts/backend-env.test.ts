// pattern-check: skip — unit tests for the env-provided signing keys
import { describe, expect, it } from 'vitest'
import { parseSigningKeys } from './backend-env'

const HEX = 'ab'.repeat(32)

describe('parseSigningKeys', () => {
    it('splits license and package keys for a staging build', () => {
        expect(
            parseSigningKeys(
                `lic-staging-1:${HEX}, pkg-staging-1:${HEX}`,
                'staging',
            ),
        ).toEqual({
            license: { 'lic-staging-1': HEX },
            package: { 'pkg-staging-1': HEX },
        })
    })

    it('gives production and local builds none', () => {
        const empty = { license: {}, package: {} }
        expect(parseSigningKeys(`lic-x-1:${HEX}`, 'production')).toEqual(empty)
        expect(parseSigningKeys(`lic-x-1:${HEX}`, 'local')).toEqual(empty)
        expect(parseSigningKeys('', 'staging')).toEqual(empty)
    })

    it('refuses anything that is not kid:64-hex', () => {
        expect(() => parseSigningKeys('lic-x-1:abc', 'staging')).toThrow()
        expect(() => parseSigningKeys(`other-1:${HEX}`, 'staging')).toThrow()
        expect(() =>
            parseSigningKeys(`lic-x-1:${HEX}:extra`, 'staging'),
        ).toThrow()
    })
})
