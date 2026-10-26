// pattern-check: skip — unit test with electron mocked, no production logic
import { describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => ({ app: {}, ipcMain: {} }))

const { createAuthCallbackQueue, deepLinkFromArgv, parseAuthCallback } =
    await import('./deep-link')

const CODE = '2b4c6a1e-9f0d-4c1b-8a3e-5d7f9b1c3e5a'

describe('parseAuthCallback', () => {
    it('accepts remappr://auth/callback with a code', () => {
        expect(parseAuthCallback(`remappr://auth/callback?code=${CODE}`)).toBe(
            CODE,
        )
    })

    it.each([
        `https://auth/callback?code=${CODE}`,
        `remappr://evil/callback?code=${CODE}`,
        `remappr://auth/other?code=${CODE}`,
        'remappr://auth/callback',
        'remappr://auth/callback?code=short',
        'remappr://auth/callback?code=a%20b%3Cscript%3Ecccccccccccccc',
        'not a url',
    ])('rejects %s', (url) => {
        expect(parseAuthCallback(url)).toBeNull()
    })
})

describe('deepLinkFromArgv', () => {
    it('finds the remappr:// argument', () => {
        expect(
            deepLinkFromArgv([
                '/usr/bin/remappr',
                '--flag',
                'remappr://auth/x',
            ]),
        ).toBe('remappr://auth/x')
        expect(deepLinkFromArgv(['/usr/bin/remappr'])).toBeNull()
    })
})

describe('createAuthCallbackQueue', () => {
    it('delivers each code once and holds it until taken', () => {
        const deliver = vi.fn()
        const q = createAuthCallbackQueue(deliver)
        const url = `remappr://auth/callback?code=${CODE}`
        expect(q.accept(url)).toBe(true)
        expect(q.accept(url)).toBe(false)
        expect(deliver).toHaveBeenCalledTimes(1)
        expect(q.take()).toBe(CODE)
        expect(q.take()).toBeNull()
        expect(q.accept('remappr://auth/callback?code=x')).toBe(false)
    })
})
