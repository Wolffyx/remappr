// pattern-check: skip — unit tests for the GitHub App authorization helpers.
import { describe, expect, it } from 'vitest'
import {
    authorizeUrl,
    freshness,
    githubAppConfig,
    githubCodeFromPaste,
    githubRedirectUri,
    installUrl,
    newPendingConnect,
    REFRESH_MARGIN_MS,
    tokensFromReply,
} from './appAuth'

const CONFIG = { clientId: 'Iv23liAbc', slug: 'remappr' }

describe('githubAppConfig', () => {
    it('needs both the client id and the slug', () => {
        expect(
            githubAppConfig({
                VITE_GITHUB_APP_CLIENT_ID: ' Iv23liAbc ',
                VITE_GITHUB_APP_SLUG: 'remappr',
            }),
        ).toEqual(CONFIG)
        expect(githubAppConfig({ VITE_GITHUB_APP_CLIENT_ID: 'x' })).toBeNull()
        expect(githubAppConfig({})).toBeNull()
    })
})

describe('authorize URL and PKCE', () => {
    it('sends state and an S256 challenge of the verifier', async () => {
        const p = await newPendingConnect(
            githubRedirectUri('https://remappr.com'),
        )
        expect(p.state).toMatch(/^[A-Za-z0-9_-]{43}$/)
        expect(p.verifier).toMatch(/^[A-Za-z0-9_-]{43}$/)
        const digest = await crypto.subtle.digest(
            'SHA-256',
            new TextEncoder().encode(p.verifier),
        )
        const expected = btoa(String.fromCharCode(...new Uint8Array(digest)))
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/, '')
        expect(p.challenge).toBe(expected)

        const url = new URL(authorizeUrl(CONFIG, p))
        expect(url.origin + url.pathname).toBe(
            'https://github.com/login/oauth/authorize',
        )
        expect(Object.fromEntries(url.searchParams)).toEqual({
            client_id: 'Iv23liAbc',
            redirect_uri: 'https://remappr.com/auth/github.html',
            state: p.state,
            code_challenge: p.challenge,
            code_challenge_method: 'S256',
        })
    })

    it('every attempt gets its own state and verifier', async () => {
        const [a, b] = await Promise.all([
            newPendingConnect(''),
            newPendingConnect(''),
        ])
        expect(a.state).not.toBe(b.state)
        expect(a.verifier).not.toBe(b.verifier)
    })

    it('links to the app install page for picking repositories', () => {
        expect(installUrl(CONFIG)).toBe(
            'https://github.com/apps/remappr/installations/new',
        )
    })
})

describe('tokens', () => {
    const NOW = 1_000_000
    it('turns relative expiries into times', () => {
        expect(
            tokensFromReply(
                {
                    access_token: 'ghu_x',
                    expires_in: 28800,
                    refresh_token: 'ghr_y',
                    refresh_token_expires_in: 15811200,
                },
                NOW,
            ),
        ).toEqual({
            accessToken: 'ghu_x',
            expiresAt: NOW + 28800_000,
            refreshToken: 'ghr_y',
            refreshExpiresAt: NOW + 15811200_000,
        })
        expect(
            tokensFromReply({ error: 'bad_verification_code' } as never),
        ).toBeNull()
    })

    it('fresh, due for a refresh, or past saving', () => {
        const t = {
            accessToken: 'a',
            expiresAt: NOW + REFRESH_MARGIN_MS + 1,
            refreshToken: 'r',
            refreshExpiresAt: NOW + 10_000_000,
        }
        expect(freshness(t, NOW)).toBe('fresh')
        expect(freshness({ ...t, expiresAt: NOW + 1000 }, NOW)).toBe('refresh')
        expect(
            freshness({ ...t, expiresAt: NOW, refreshExpiresAt: NOW - 1 }, NOW),
        ).toBe('expired')
        expect(
            freshness({ ...t, expiresAt: NOW, refreshToken: null }, NOW),
        ).toBe('expired')
        // An app with non-expiring tokens never refreshes.
        expect(freshness({ ...t, expiresAt: null }, NOW)).toBe('fresh')
    })
})

describe('githubCodeFromPaste', () => {
    it('takes the bare code or the URL that carries it', () => {
        expect(githubCodeFromPaste(' 8f2e4c1a9b7d3e5f6a0c ')).toBe(
            '8f2e4c1a9b7d3e5f6a0c',
        )
        expect(
            githubCodeFromPaste(
                'remappr://github/callback?code=8f2e4c1a9b7d3e5f6a0c&state=x',
            ),
        ).toBe('8f2e4c1a9b7d3e5f6a0c')
        expect(githubCodeFromPaste('<script>')).toBeNull()
        expect(githubCodeFromPaste('https://x/?code=a%20b')).toBeNull()
    })
})
