import { describe, expect, it } from 'vitest'
import { authSiteUrl, codeFromPaste } from './authRedirect'

const CODE = '2b4c6a1e-9f0d-4c1b-8a3e-5d7f9b1c3e5a'

describe('authSiteUrl', () => {
    it('defaults to localhost in dev and remappr.com otherwise', () => {
        expect(authSiteUrl({ DEV: true }, null)).toBe('http://localhost:5173')
        expect(authSiteUrl({ DEV: false }, null)).toBe('https://remappr.com')
    })

    it('a build uses its site, without a trailing slash', () => {
        expect(
            authSiteUrl(
                { DEV: false, VITE_AUTH_SITE_URL: 'https://dev.remappr.com/' },
                'https://whatever.example',
            ),
        ).toBe('https://dev.remappr.com')
    })

    it('a dev run opens its own dev server, whatever the backend', () => {
        expect(
            authSiteUrl(
                { DEV: true, VITE_AUTH_SITE_URL: 'https://dev.remappr.com' },
                'http://localhost:5175',
            ),
        ).toBe('http://localhost:5175')
    })

    it('an explicit override wins, in dev too', () => {
        expect(
            authSiteUrl(
                {
                    DEV: true,
                    VITE_AUTH_SITE_URL: 'https://dev.remappr.com',
                    VITE_AUTH_SITE_OVERRIDE: 'http://[::1]:5175/',
                },
                'http://localhost:5173',
            ),
        ).toBe('http://[::1]:5175')
    })
})

describe('codeFromPaste', () => {
    it('takes a bare code or one inside a pasted URL', () => {
        expect(codeFromPaste(`  ${CODE} `)).toBe(CODE)
        expect(codeFromPaste(`remappr://auth/callback?code=${CODE}`)).toBe(CODE)
        expect(
            codeFromPaste(`https://remappr.com/auth/desktop.html?code=${CODE}`),
        ).toBe(CODE)
    })

    it('rejects anything else', () => {
        expect(codeFromPaste('hello')).toBeNull()
        expect(codeFromPaste('https://remappr.com/?code=<x>')).toBeNull()
    })
})
