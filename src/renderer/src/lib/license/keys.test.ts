// pattern-check: skip — unit tests for the per-environment trusted keys
import { describe, expect, it } from 'vitest'
import { licensePublicKey } from './keys'
import { packagePublicKey } from '@shared/builderPackage'

const prod = { DEV: false }

describe('trusted signing keys', () => {
    it('a production build trusts the production keys only', () => {
        expect(
            licensePublicKey('lic-production-1', prod, 'production'),
        ).toMatch(/^[0-9a-f]{64}$/)
        expect(licensePublicKey('lic-production-1', prod, 'staging')).toBeNull()
        expect(licensePublicKey('lic-dev-1', prod, 'production')).toBeNull()
        expect(
            packagePublicKey('pkg-production-1', false, 'production'),
        ).toMatch(/^[0-9a-f]{64}$/)
        expect(
            packagePublicKey('pkg-production-1', false, 'staging'),
        ).toBeNull()
    })

    it('a build with no environment trusts no hosted key', () => {
        expect(licensePublicKey('lic-production-1', prod, '')).toBeNull()
        expect(packagePublicKey('pkg-production-1', false, '')).toBeNull()
    })

    it('the dev key works in dev and against the local backend only', () => {
        expect(
            licensePublicKey('lic-dev-1', { DEV: true }, 'staging'),
        ).not.toBeNull()
        expect(licensePublicKey('lic-dev-1', prod, 'local')).not.toBeNull()
        expect(packagePublicKey('pkg-dev-1', false, 'local')).not.toBeNull()
        expect(packagePublicKey('pkg-dev-1', false, 'production')).toBeNull()
    })

    it('a key id cannot reach the prototype', () => {
        expect(licensePublicKey('constructor', prod, 'production')).toBeNull()
        expect(
            licensePublicKey('lic-production-1', prod, 'constructor'),
        ).toBeNull()
        expect(packagePublicKey('__proto__', true, 'local')).toBeNull()
    })
})
