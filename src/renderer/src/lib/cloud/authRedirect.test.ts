import { describe, expect, it } from 'vitest'
import { authSiteUrl, codeFromPaste } from './authRedirect'

const CODE = '2b4c6a1e-9f0d-4c1b-8a3e-5d7f9b1c3e5a'

describe('authSiteUrl', () => {
    it('defaults to localhost in dev and remappr.com otherwise', () => {
        expect(authSiteUrl({ DEV: true })).toBe('http://localhost:5173')
        expect(authSiteUrl({ DEV: false })).toBe('https://remappr.com')
    })

    it('uses the configured site without a trailing slash', () => {
        expect(
            authSiteUrl({
                DEV: false,
                VITE_AUTH_SITE_URL: 'https://dev.remappr.com/',
            }),
        ).toBe('https://dev.remappr.com')
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
