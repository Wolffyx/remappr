// pattern-check: skip — unit tests for the friendly cloud error messages
import { describe, expect, it } from 'vitest'
import { cloudErrorMessage } from './errors'

describe('cloudErrorMessage', () => {
    it('explains the email rate limit', () => {
        expect(
            cloudErrorMessage({ message: 'email rate limit exceeded' }),
        ).toMatch(/Too many sign-in emails/)
        expect(
            cloudErrorMessage(
                new Error(
                    'For security purposes, you can only request this after 52 seconds.',
                ),
            ),
        ).toMatch(/Wait a few seconds/)
    })

    it('explains refused links by code or by wording', () => {
        const linked = Object.assign(
            new Error('Identity is already linked to another user'),
            { code: 'identity_already_exists' },
        )
        expect(cloudErrorMessage(linked)).toMatch(/another Remappr account/)
        expect(
            cloudErrorMessage({
                code: 'identity_already_exists',
                message: 'reworded',
            }),
        ).toMatch(/another Remappr account/)
        expect(
            cloudErrorMessage({
                message: 'User must have at least 1 identity after unlinking',
            }),
        ).toMatch(/only way to sign in/)
        expect(
            cloudErrorMessage({ message: 'Manual linking is disabled' }),
        ).toMatch(/not turned on/)
    })

    it('passes anything else through', () => {
        expect(cloudErrorMessage({ message: 'something odd' })).toBe(
            'something odd',
        )
    })
})
