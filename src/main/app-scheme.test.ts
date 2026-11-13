// pattern-check: skip — unit tests for the app:// resolver
import { describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => ({ protocol: {} }))

import { contentTypeOf, resolveAppFile } from './app-scheme'

const ROOT = '/opt/remappr/out/renderer'

describe('resolveAppFile', () => {
    it('serves assets and falls back to index.html for app routes', () => {
        expect(resolveAppFile(ROOT, 'app://remappr/assets/index-1.js')).toBe(
            `${ROOT}/assets/index-1.js`,
        )
        expect(resolveAppFile(ROOT, 'app://remappr/')).toBe(
            `${ROOT}/index.html`,
        )
        expect(resolveAppFile(ROOT, 'app://remappr/library')).toBe(
            `${ROOT}/index.html`,
        )
    })

    it('never leaves the renderer folder or serves another host', () => {
        // URL parsing collapses dot segments (plain or encoded) before we see them.
        for (const url of [
            'app://remappr/../../etc/passwd',
            'app://remappr/%2e%2e/%2e%2e/etc/passwd.txt',
            'app://remappr/assets/../../../x.js',
        ])
            expect(resolveAppFile(ROOT, url)?.startsWith(`${ROOT}/`)).toBe(true)
        expect(resolveAppFile(ROOT, 'app://evil/index.html')).toBeNull()
        expect(resolveAppFile(ROOT, 'file:///etc/passwd')).toBeNull()
        expect(resolveAppFile(ROOT, 'app://remappr/a%00b.js')).toBeNull()
    })

    it('types what it serves', () => {
        expect(contentTypeOf('x.js')).toBe('text/javascript')
        expect(contentTypeOf('x.woff2')).toBe('font/woff2')
        expect(contentTypeOf('x.bin')).toBe('application/octet-stream')
    })
})
