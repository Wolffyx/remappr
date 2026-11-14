// pattern-check: skip — unit tests; a stubbed bridge shows the platform is read
// from the whitelisted `api`, not the removed `window.electron`.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { detectPlatform } from '@/lib/github'
import { getPlatform } from './api'

const bridge = (platform: string): unknown => ({
    platform,
    invoke: vi.fn(),
    on: vi.fn(),
})

afterEach(() => vi.unstubAllGlobals())

describe('getPlatform (L4.22 follow-up)', () => {
    it('reads the platform from the whitelisted api', () => {
        vi.stubGlobal('window', { api: bridge('darwin') })
        expect(getPlatform()).toBe('darwin')
    })

    it('ignores a legacy window.electron bundle', () => {
        vi.stubGlobal('window', {
            electron: { process: { platform: 'darwin' } },
        })
        expect(getPlatform()).toBeUndefined()
    })

    it('is undefined outside Electron', () => {
        vi.stubGlobal('window', {})
        expect(getPlatform()).toBeUndefined()
    })
})

describe('detectPlatform', () => {
    it('prefers the bridged platform over the user agent', () => {
        vi.stubGlobal('window', { api: bridge('win32') })
        vi.stubGlobal('navigator', { userAgent: 'Macintosh' })
        expect(detectPlatform()).toBe('win32')
    })

    it('falls back to the user agent without the bridge', () => {
        vi.stubGlobal('window', {})
        vi.stubGlobal('navigator', { userAgent: 'Macintosh' })
        expect(detectPlatform()).toBe('darwin')
    })
})
