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
vi.mock('./secret-store', () => ({ getStoredSecret: () => h.token }))

import {
    isAllowedArtifactUrl,
    registerGithubArtifactHandler,
} from './github-artifact'

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
