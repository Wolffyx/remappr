// pattern-check: skip — unit test with electron mocked, no production logic
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { IpcChannels } from '../shared/ipc-types'

type Handler = (...args: unknown[]) => unknown

const h = vi.hoisted(() => ({
    ipc: new Map<string, (...args: unknown[]) => unknown>(),
    token: 'ghp_secret' as string | null,
}))

vi.mock('electron', () => ({
    ipcMain: {
        handle: (channel: string, fn: Handler) => h.ipc.set(channel, fn),
    },
}))
// Every stored key reads as the token: the GitHub App entry is then not JSON,
// so githubToken() falls back to the personal token, `ghp_secret`.
vi.mock('./secret-store', () => ({ getStoredSecret: () => h.token }))

import {
    githubToken,
    isAllowedArtifactUrl,
    registerGithubArtifactHandler,
} from './github-artifact'

const store =
    (values: Record<string, string>) =>
    (key: string): string | null =>
        values[key] ?? null

describe('githubToken', () => {
    const app = (expiresAt: number | null): string =>
        JSON.stringify({ accessToken: 'app-token', expiresAt })

    it('prefers a valid GitHub App token', () => {
        const read = store({ githubApp: app(10_000_000), githubToken: 'pat' })
        expect(githubToken(read, 1_000)).toBe('app-token')
    })

    it('takes a non-expiring app token', () => {
        expect(githubToken(store({ githubApp: app(null) }), 1_000)).toBe(
            'app-token',
        )
    })

    it('falls back to the personal token when the app token ran out', () => {
        const read = store({ githubApp: app(20_000), githubToken: 'pat' })
        expect(githubToken(read, 1_000_000)).toBe('pat')
    })

    it('falls back on an unreadable connection, and has none without either', () => {
        expect(
            githubToken(store({ githubApp: '{bad', githubToken: 'pat' }), 0),
        ).toBe('pat')
        expect(githubToken(store({}), 0)).toBeNull()
    })
})

describe('github artifact proxy (L4.23)', () => {
    const fetchMock = vi.fn(
        async () => new Response(new Uint8Array([1, 2, 3]), { status: 200 }),
    )

    beforeEach(() => {
        h.ipc.clear()
        fetchMock.mockClear()
        vi.stubGlobal('fetch', fetchMock)
        registerGithubArtifactHandler()
    })

    const download = (url: string): Promise<unknown> =>
        Promise.resolve(
            h.ipc.get(IpcChannels.GITHUB_DOWNLOAD_ARTIFACT)!({}, { url }),
        )

    it('accepts only https://api.github.com', () => {
        expect(
            isAllowedArtifactUrl('https://api.github.com/repos/a/b/zip'),
        ).toBe(true)
        expect(
            isAllowedArtifactUrl('http://api.github.com/repos/a/b/zip'),
        ).toBe(false)
        expect(isAllowedArtifactUrl('https://api.github.com.evil.io/x')).toBe(
            false,
        )
        expect(isAllowedArtifactUrl('https://api.github.com:8443/x')).toBe(
            false,
        )
        expect(isAllowedArtifactUrl('not a url')).toBe(false)
    })

    it('refuses an http URL before attaching the token', async () => {
        expect(await download('http://api.github.com/repos/a/b/zip')).toBeNull()
        expect(fetchMock).not.toHaveBeenCalled()
    })

    it('sends the bearer token to an https URL', async () => {
        const bytes = await download('https://api.github.com/repos/a/b/zip')
        expect(bytes).toEqual(new Uint8Array([1, 2, 3]))
        expect(fetchMock).toHaveBeenCalledWith(
            'https://api.github.com/repos/a/b/zip',
            expect.objectContaining({
                headers: expect.objectContaining({
                    Authorization: 'Bearer ghp_secret',
                }),
            }),
        )
    })
})
