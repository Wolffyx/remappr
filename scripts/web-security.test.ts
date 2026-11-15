// pattern-check: skip — unit tests for the web CSP
import { describe, expect, it } from 'vitest'
import { pagesHeaders, webCsp } from './web-security'

describe('webCsp', () => {
    it('allows the backend over https and wss, nothing inline or eval', () => {
        const csp = webCsp('https://abc.supabase.co')
        expect(csp).toContain("script-src 'self' 'wasm-unsafe-eval';")
        expect(csp).not.toMatch(/script-src[^;]*'unsafe-(inline|eval)'/)
        expect(csp).toMatch(/connect-src [^;]*https:\/\/abc\.supabase\.co/)
        expect(csp).toMatch(/connect-src [^;]*wss:\/\/abc\.supabase\.co/)
        expect(csp).toContain("object-src 'none'")
    })

    it('has no backend origins without a backend', () => {
        expect(webCsp(undefined)).not.toContain('supabase')
    })

    it('adds frame-ancestors and the other headers for Pages', () => {
        const headers = pagesHeaders(webCsp(undefined))
        expect(headers).toContain("frame-ancestors 'none'")
        expect(headers).toContain('X-Content-Type-Options: nosniff')
    })
})
