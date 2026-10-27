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

    it('passes anything else through', () => {
        expect(cloudErrorMessage({ message: 'something odd' })).toBe(
            'something odd',
        )
    })
})
