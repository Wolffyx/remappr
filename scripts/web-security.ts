// pattern-check: skip — one build-only Vite plugin: a CSP string emitted as a
// <meta> (GitHub Pages cannot send headers) and as Cloudflare Pages _headers.
//
// The web app's content security policy. Dev builds skip it (Vite's HMR needs
// inline scripts and eval); every production web build carries it. The cloud
// backend's host comes from VITE_SUPABASE_URL at build time.
import type { Plugin } from 'vite'

const AVATAR_HOSTS = [
    'https://avatars.githubusercontent.com',
    'https://lh3.googleusercontent.com',
    'https://cdn.discordapp.com',
]

function backendOrigins(supabaseUrl: string | undefined): {
    https: string[]
    wss: string[]
} {
    if (!supabaseUrl) return { https: [], wss: [] }
    const u = new URL(supabaseUrl)
    return {
        https: [u.origin],
        wss: [`${u.protocol === 'https:' ? 'wss' : 'ws'}://${u.host}`],
    }
}

/** The policy for a build talking to this backend (null = no backend). */
export function webCsp(supabaseUrl: string | undefined): string {
    const backend = backendOrigins(supabaseUrl)
    const directives: Record<string, string[]> = {
        'default-src': ["'self'"],
        'script-src': ["'self'", "'wasm-unsafe-eval'"],
        // Radix / Tailwind inject inline styles at runtime.
        'style-src': ["'self'", "'unsafe-inline'"],
        'img-src': [
            "'self'",
            'data:',
            'blob:',
            'https://raw.githubusercontent.com',
            ...AVATAR_HOSTS,
            ...backend.https,
        ],
        'font-src': ["'self'", 'data:'],
        // GitHub: releases/news, the VIA registry, cloud-build artifacts.
        'connect-src': [
            "'self'",
            'https://api.github.com',
            'https://*.githubusercontent.com',
            ...backend.https,
            ...backend.wss,
        ],
        'worker-src': ["'self'", 'blob:'],
        'manifest-src': ["'self'"],
        'object-src': ["'none'"],
        'base-uri': ["'self'"],
        'form-action': ["'none'"],
    }
    return Object.entries(directives)
        .map(([k, v]) => `${k} ${v.join(' ')}`)
        .join('; ')
}

/** Headers for Cloudflare Pages (public/_headers format). */
export function pagesHeaders(csp: string): string {
    return [
        '/*',
        // frame-ancestors only works as a header, not in a <meta> policy.
        `  Content-Security-Policy: ${csp}; frame-ancestors 'none'`,
        '  X-Content-Type-Options: nosniff',
        '  Referrer-Policy: strict-origin-when-cross-origin',
        '  Permissions-Policy: camera=(), microphone=(), geolocation=()',
        '',
    ].join('\n')
}

export function webSecurityPlugin(supabaseUrl: string | undefined): Plugin {
    const csp = webCsp(supabaseUrl)
    return {
        name: 'remappr-web-security',
        apply: 'build',
        transformIndexHtml: () => [
            {
                tag: 'meta',
                attrs: {
                    'http-equiv': 'Content-Security-Policy',
                    content: csp,
                },
                injectTo: 'head-prepend',
            },
        ],
        generateBundle() {
            this.emitFile({
                type: 'asset',
                fileName: '_headers',
                source: pagesHeaders(csp),
            })
        },
    }
}
