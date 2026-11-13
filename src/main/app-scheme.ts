// Pattern check: no GoF pattern (-) — rejected — a pure URL → file resolver
// and the protocol handler that uses it; one caller (index.ts).
//
// Packaged builds serve the renderer from app://remappr/ instead of file://.
// A real origin makes CORS and the CSP behave (file:// pages have an opaque
// "null" origin and extra privileges), and lets the GrantFileProtocolExtra-
// Privileges fuse be turned off. Every response carries the app's CSP.
import { protocol } from 'electron'
import { readFile } from 'node:fs/promises'
import { extname, join, normalize, sep } from 'node:path'

export const APP_SCHEME = 'app'
export const APP_HOST = 'remappr'
export const APP_ORIGIN = `${APP_SCHEME}://${APP_HOST}`

const TYPES: Record<string, string> = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript',
    '.mjs': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.webp': 'image/webp',
    '.ico': 'image/x-icon',
    '.woff2': 'font/woff2',
    '.wasm': 'application/wasm',
    '.txt': 'text/plain; charset=utf-8',
}

/** The file to serve for an app:// URL: the asset itself, index.html for
 *  app routes (no extension), or null for anything outside the renderer
 *  folder or on another host. */
export function resolveAppFile(root: string, url: string): string | null {
    let u: URL
    try {
        u = new URL(url)
    } catch {
        return null
    }
    if (u.protocol !== `${APP_SCHEME}:` || u.host !== APP_HOST) return null
    const path = decodeURIComponent(u.pathname)
    if (path.includes('\0')) return null
    const target = normalize(join(root, path))
    if (
        target !== root &&
        !target.startsWith(root.endsWith(sep) ? root : root + sep)
    )
        return null
    if (path === '/' || !extname(path)) return join(root, 'index.html')
    return target
}

export function contentTypeOf(file: string): string {
    return TYPES[extname(file).toLowerCase()] ?? 'application/octet-stream'
}

/** The privileges app:// needs (registered with the other schemes before ready). */
export const APP_SCHEME_PRIVILEGES = {
    scheme: APP_SCHEME,
    privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        corsEnabled: true,
        codeCache: true,
    },
}

/** After ready: serve the renderer folder over app://remappr/. */
export function registerAppProtocol(root: string, csp: string): void {
    protocol.handle(APP_SCHEME, async (req) => {
        const file = resolveAppFile(root, req.url)
        if (!file) return new Response(null, { status: 404 })
        const body = await readFile(file).catch(() => null)
        if (!body) return new Response(null, { status: 404 })
        return new Response(body, {
            headers: {
                'Content-Type': contentTypeOf(file),
                'Content-Security-Policy': csp,
            },
        })
    })
}
