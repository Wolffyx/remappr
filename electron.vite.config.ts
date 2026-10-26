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
