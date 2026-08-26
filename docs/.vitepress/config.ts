// pattern-check: skip — VitePress defineConfig data object, declarative docs-site config, no logic/abstraction
import { defineConfig } from 'vitepress'

// Docs site for Remappr — published at https://docs.remappr.com (Cloudflare
// Pages). Two doc trees: the user Guide (builder walkthrough) and the Reference
// (JSON keymap config + compilers). `base: '/'` because it serves a custom
// domain root, not a GitHub-Pages subpath.
export default defineConfig({
    lang: 'en-US',
    title: 'Remappr',
    description:
        'Remappr — a universal device manager. Connect, remap, light up and build your devices across firmwares (ZMK, QMK, VIA, Vial, Keychron, more to come). Docs for the Builder, the editor and the JSON keymap config.',
    base: '/',
    cleanUrls: true,
    lastUpdated: true,
    sitemap: { hostname: 'https://docs.remappr.com' },

    head: [
        ['link', { rel: 'icon', href: '/favicon.ico' }],
        ['meta', { name: 'theme-color', content: '#6d5efc' }],
    ],

    themeConfig: {
        logo: '/remappr.webp',
        siteTitle: 'Remappr Docs',

        nav: [
            { text: 'Guide', link: '/guide/getting-started' },
            { text: 'Builder', link: '/guide/builder/overview' },
            { text: 'App & Editor', link: '/guide/app/connecting' },
            { text: 'Config Reference', link: '/reference/config/overview' },
            { text: 'Developers', link: '/dev/architecture' },
            { text: 'Open app ↗', link: 'https://remappr.com' },
        ],

        sidebar: {
            '/guide/': [
                {
                    text: 'Getting Started',
                    items: [
                        {
                            text: 'What is Remappr?',
                            link: '/guide/getting-started',
                        },
                        {
                            text: 'Installation',
                            link: '/guide/installation',
                        },
                        { text: 'Roadmap', link: '/guide/roadmap' },
                    ],
                },
                {
                    text: 'The Builder',
                    collapsed: false,
                    items: [
                        {
                            text: 'Overview & toolbar',
                            link: '/guide/builder/overview',
                        },
                        {
                            text: 'Building the layout',
                            link: '/guide/builder/layout',
                        },
                        {
                            text: 'Key inspector',
                            link: '/guide/builder/inspector',
                        },
                        {
                            text: 'Layers & bindings',
                            link: '/guide/builder/layers-and-bindings',
                        },
                        {
                            text: 'Identity & hardware',
                            link: '/guide/builder/identity-and-hardware',
                        },
                        { text: 'Lighting', link: '/guide/builder/lighting' },
                        {
                            text: 'Export, build & flash',
                            link: '/guide/builder/export-build-flash',
                        },
                    ],
                },
                {
                    text: 'The App (connected device)',
                    collapsed: false,
                    items: [
                        {
                            text: 'Connecting a device',
                            link: '/guide/app/connecting',
                        },
                        { text: 'The keymap editor', link: '/guide/editor' },
                        {
                            text: 'RGB & lighting',
                            link: '/guide/app/rgb-lighting',
                        },
                        {
                            text: 'Advanced features',
                            link: '/guide/app/advanced',
                        },
                        {
                            text: 'App settings',
                            link: '/guide/app/settings',
                        },
                        {
                            text: 'Export & flash',
                            link: '/guide/app/export-flash',
                        },
                    ],
                },
            ],
            '/reference/': [
                {
                    text: 'JSON Keymap Config',
                    items: [
                        {
                            text: 'Overview',
                            link: '/reference/config/overview',
                        },
                        {
                            text: 'Keymap format',
                            link: '/reference/config/keymap-format',
                        },
                        { text: 'Actions', link: '/reference/config/actions' },
                        {
                            text: 'Keycodes & modifiers',
                            link: '/reference/config/keycodes',
                        },
                        {
                            text: 'Hardware',
                            link: '/reference/config/hardware',
                        },
                        {
                            text: 'Firmware targets',
                            link: '/reference/config/firmware-targets',
                        },
                        {
                            text: 'Normalization & round-trip',
                            link: '/reference/config/normalization',
                        },
                        {
                            text: 'JSON Schema',
                            link: '/reference/config/json-schema',
                        },
                    ],
                },
            ],
            '/dev/': [
                {
                    text: 'Developers',
                    items: [
                        {
                            text: 'Project structure',
                            link: '/dev/project-structure',
                        },
                        { text: 'Architecture', link: '/dev/architecture' },
                        { text: 'Compilers', link: '/dev/compilers' },
                        {
                            text: 'Adding a firmware target',
                            link: '/dev/adding-a-firmware-target',
                        },
                        { text: 'Contributing', link: '/dev/contributing' },
                    ],
                },
            ],
        },

        search: { provider: 'local' },

        socialLinks: [
            {
                icon: 'github',
                link: 'https://github.com/Wolffyx/remappr',
            },
        ],

        editLink: {
            pattern: 'https://github.com/Wolffyx/remappr/edit/main/docs/:path',
            text: 'Edit this page on GitHub',
        },

        footer: {
            message:
                'Apache-2.0. Originally forked from ZMK Studio; application layer fully rewritten.',
            copyright: 'Remappr',
        },
    },
})
