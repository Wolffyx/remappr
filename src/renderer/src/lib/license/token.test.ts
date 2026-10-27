// pattern-check: skip — unit tests for offline license verification
import { describe, expect, it } from 'vitest'
import { ed25519 } from '@noble/curves/ed25519.js'
import {
    LEASE_MAX_S,
    verifyLicense,
    type LicenseClaims,
    type VerifyContext,
} from './token'

const secret = ed25519.utils.randomSecretKey()
const pub = Buffer.from(ed25519.getPublicKey(secret)).toString('hex')
const b64url = (u: Uint8Array): string => Buffer.from(u).toString('base64url')

const NOW = Date.UTC(2026, 9, 27)
const IAT = Math.floor(NOW / 1000) - 60
const LEASE = 30 * 24 * 60 * 60

function sign(claims: Partial<LicenseClaims>): string {
    const full: LicenseClaims = {
        v: 1,
        kid: 'k1',
        sub: 'u',
        dev: 'd'.repeat(64),
        mach: null,
        feat: { builder: 1 },
        plan: 'lifetime',
        iat: IAT,
        exp: null,
        ...claims,
    }
    const body = new TextEncoder().encode(JSON.stringify(full))
    return `${b64url(body)}.${b64url(ed25519.sign(body, secret))}`
}

const ctx: VerifyContext = {
    device: 'd'.repeat(64),
    machine: null,
    now: NOW,
    maxSeen: NOW,
    publicKey: (kid) => (kid === 'k1' ? pub : null),
}

describe('verifyLicense', () => {
    it('needs a lease of at most 31 days on a subscription', () => {
        const sub = { plan: 'subscription' as const }
        expect(verifyLicense(sign(sub), ctx)).toEqual({
            ok: false,
            problem: 'no_lease',
        })
        expect(
            verifyLicense(sign({ ...sub, exp: IAT + LEASE_MAX_S + 1 }), ctx),
        ).toEqual({ ok: false, problem: 'no_lease' })
        expect(
            verifyLicense(sign({ ...sub, exp: IAT + LEASE }), ctx),
        ).toMatchObject({ ok: true })
    })

    it('keeps a lifetime license working offline for good', () => {
        expect(
            verifyLicense(sign({}), {
                ...ctx,
                now: NOW + 2 * 365 * 86_400_000,
                maxSeen: NOW + 3 * 365 * 86_400_000,
            }),
        ).toMatchObject({ ok: true })
    })

    it('accepts a lifetime license for this device', () => {
        expect(verifyLicense(sign({}), ctx)).toMatchObject({ ok: true })
    })

    it('refuses tampering, other keys, devices and machines', () => {
        const token = sign({})
        const [body, sig] = token.split('.')
        const forged = Buffer.from(body, 'base64url')
            .toString()
            .replace('"lifetime"', '"grant"')
        expect(
            verifyLicense(
                `${b64url(new TextEncoder().encode(forged))}.${sig}`,
                ctx,
            ),
        ).toEqual({ ok: false, problem: 'bad_signature' })
        expect(verifyLicense(sign({ kid: 'k2' }), ctx)).toEqual({
            ok: false,
            problem: 'untrusted_key',
        })
        expect(verifyLicense(sign({ dev: 'e'.repeat(64) }), ctx)).toEqual({
            ok: false,
            problem: 'other_device',
        })
        expect(
            verifyLicense(sign({ mach: 'a'.repeat(64) }), {
                ...ctx,
                machine: 'b'.repeat(64),
            }),
        ).toEqual({
            ok: false,
            problem: 'other_machine',
        })
        expect(verifyLicense('garbage', ctx)).toEqual({
            ok: false,
            problem: 'malformed',
        })
    })

    it('expires subscriptions and catches a clock turned back', () => {
        const exp = Math.floor(NOW / 1000) + 3600
        expect(
            verifyLicense(sign({ plan: 'subscription', exp }), ctx),
        ).toMatchObject({ ok: true })
        expect(
            verifyLicense(sign({ plan: 'subscription', exp }), {
                ...ctx,
                now: NOW + 7200_000,
            }),
        ).toEqual({
            ok: false,
            problem: 'expired',
        })
        expect(
            verifyLicense(sign({ plan: 'subscription', exp }), {
                ...ctx,
                maxSeen: NOW + 3 * 86_400_000,
            }),
        ).toEqual({ ok: false, problem: 'clock_rollback' })
        // A lifetime license ignores the clock.
        expect(
            verifyLicense(sign({}), { ...ctx, maxSeen: NOW + 30 * 86_400_000 }),
        ).toMatchObject({ ok: true })
    })
})
