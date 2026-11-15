// pattern-check: skip — unit tests for the GitHub token resolver over mocks.
import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({
    secrets: new Map<string, string>(),
    invoked: [] as Record<string, string>[],
    reply: null as unknown,
    replyError: null as unknown,
}))

vi.mock('@/lib/secretStore', () => ({
    GITHUB_TOKEN_KEY: 'githubToken',
    getSecret: async (k: string) => h.secrets.get(k) ?? '',
    setSecret: async (k: string, v: string) => {
        if (v) h.secrets.set(k, v)
        else h.secrets.delete(k)
    },
}))

vi.mock('@/lib/cloud/client', () => ({
    getCloudClient: async () => ({
        functions: {
            invoke: async (_n: string, o: { body: Record<string, string> }) => {
                h.invoked.push(o.body)
                return { data: h.reply, error: h.replyError }
            },
        },
    }),
}))

import { getGithubToken } from './connection'

const stored = (over: Record<string, unknown>): void => {
    h.secrets.set(
        'githubApp',
        JSON.stringify({
            accessToken: 'ghu_old',
            expiresAt: Date.now() + 60 * 60 * 1000,
            refreshToken: 'ghr_old',
            refreshExpiresAt: Date.now() + 10 * 24 * 60 * 60 * 1000,
            login: 'me',
            avatarUrl: null,
            ...over,
        }),
    )
}

describe('getGithubToken', () => {
    beforeEach(() => {
        h.secrets.clear()
        h.invoked = []
        h.reply = null
        h.replyError = null
    })

    it('uses a fresh app token as it is', async () => {
        stored({})
        expect(await getGithubToken()).toBe('ghu_old')
        expect(h.invoked).toEqual([])
    })

    it('refreshes a token about to run out, once for concurrent callers', async () => {
        stored({ expiresAt: Date.now() + 1000 })
        h.reply = {
            access_token: 'ghu_new',
            expires_in: 28800,
            refresh_token: 'ghr_new',
            refresh_token_expires_in: 15811200,
        }
        const [a, b] = await Promise.all([getGithubToken(), getGithubToken()])
        expect([a, b]).toEqual(['ghu_new', 'ghu_new'])
        expect(h.invoked).toEqual([
            { action: 'refresh', refreshToken: 'ghr_old' },
        ])
        const kept = JSON.parse(h.secrets.get('githubApp')!)
        expect(kept).toMatchObject({ accessToken: 'ghu_new', login: 'me' })
    })

    it('a refused refresh ends the connection; the personal token takes over', async () => {
        stored({ expiresAt: Date.now() })
        h.secrets.set('githubToken', 'ghp_pat')
        h.replyError = {
            context: new Response(
                JSON.stringify({ error: 'bad_refresh_token' }),
            ),
        }
        expect(await getGithubToken()).toBe('ghp_pat')
        expect(h.secrets.has('githubApp')).toBe(false)
    })

    it('an expired refresh token needs a new connect', async () => {
        stored({ expiresAt: Date.now(), refreshExpiresAt: Date.now() - 1 })
        expect(await getGithubToken()).toBeNull()
        expect(h.invoked).toEqual([])
    })
})
