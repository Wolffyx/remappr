import { resolve } from 'path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react-swc'
import pkg from './package.json' with { type: 'json' }
import { remapprDedupe } from './scripts/remappr-dedupe'
import { vendorChunks } from './scripts/vendor-chunks'

const versionDefine = { __APP_VERSION__: JSON.stringify(pkg.version) }

export default defineConfig({
    main: {
        define: versionDefine,
        build: {
            rollupOptions: {
                external: ['serialport', 'dbus-next', 'node-hid'],
            },
        },
    },
    preload: { define: versionDefine },
    renderer: {
        // .env* live at the repo root (same as the web vite.config.ts).
        envDir: resolve('.'),
        // Static files (fonts, icons, auth pages, a dev builder package) live
        // in the repo-root public/, as for the web build; electron-vite's
        // default (src/renderer/public) does not exist.
        publicDir: resolve('public'),
        define: versionDefine,
        resolve: {
            // See scripts/remappr-dedupe.ts — single copy of context/store deps
            // across the app + symlinked @remappr/* sibling repos.
            dedupe: remapprDedupe,
            alias: {
                '@renderer': resolve('src/renderer/src'),
                '@': resolve('src/renderer/src'),
                '@firmware': resolve('src/firmware'),
                '@shared': resolve('src/shared'),
            },
        },
        plugins: [react()],
        build: {
            rollupOptions: {
                output: { manualChunks: vendorChunks },
            },
        },
    },
})
