import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import pkg from './package.json' with { type: 'json' }
import { remapprDedupe } from './scripts/remappr-dedupe'
import { builderSourceDefine } from './scripts/builder-source'
import { webSecurityPlugin } from './scripts/web-security'
import { pwaPlugin } from './scripts/pwa'
import { vendorChunks } from './scripts/vendor-chunks'
import { backendDefine } from './scripts/backend-env'
// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
    // Picks the Supabase backend (.env.local REMAPPR_BACKEND, dev by default).
    const backend = backendDefine(__dirname, mode)
    return {
        base: '/', //todo remove it after finishing refactoring
        root: path.resolve(__dirname, 'src/renderer'),
        publicDir: path.resolve(__dirname, 'public'),
        plugins: [
            react(),
            tailwindcss(),
            // Production web builds carry a CSP (meta + Cloudflare _headers).
            webSecurityPlugin(process.env.VITE_SUPABASE_URL),
            // Production web builds: the offline app-shell service worker.
            pwaPlugin(),
        ],
        define: {
            __APP_VERSION__: JSON.stringify(pkg.version),
            ...builderSourceDefine(__dirname),
            ...backend,
        },
        resolve: {
            // Symlinked @remappr/* sibling repos carry their own node_modules.
            // Force a single copy of context/store-bearing deps so React context
            // and zustand stores share identity across the app + symlinked code.
            dedupe: remapprDedupe,
            alias: {
                '@': path.resolve(__dirname, './src/renderer/src'),
                '@firmware': path.resolve(__dirname, './src/firmware'),
                '@shared': path.resolve(__dirname, './src/shared'),
            },
        },
        // .env* live at the repo root (same as electron-vite), not in `root`.
        envDir: __dirname,
        envPrefix: ['VITE_'],
        build: {
            outDir: path.resolve(__dirname, 'dist'),
            target: 'esnext',
            minify: 'esbuild',
            rollupOptions: {
                output: { manualChunks: vendorChunks },
            },
        },
    }
})
