import { describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => ({ ipcMain: { handle: vi.fn() } }))
vi.mock('./secret-store', () => ({ getStoredSecret: () => null }))

const { githubToken } = await import('./github-artifact')

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
