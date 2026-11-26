import { describe, expect, it } from 'vitest'
import { providersFromSettings } from './providers'

describe('providersFromSettings', () => {
    it('keeps the providers the server has on, in our order', () => {
        expect(
            providersFromSettings({
                external: {
                    google: true,
                    github: true,
                    discord: false,
                    email: true,
                    gitlab: true,
                },
            }),
        ).toEqual(['github', 'google'])
    })

    it('is empty for an email-only server or a strange reply', () => {
        expect(
            providersFromSettings({ external: { email: true, github: false } }),
        ).toEqual([])
        expect(providersFromSettings(null)).toEqual([])
        expect(providersFromSettings({})).toEqual([])
    })
})
