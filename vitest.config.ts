import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
    // Build constants the app reads (see scripts/backend-env.ts).
    define: { __REMAPPR_ENV__: JSON.stringify('test') },
    test: {
        globals: true,
        environment: 'node',
        include: ['src/**/*.test.ts', 'scripts/**/*.test.ts'],
        deps: {
            // Handle ESM/CJS interop issues
            interopDefault: true,
        },
        server: {
            deps: {
                // Its ESM build imports without file extensions; let Vite
                // resolve them instead of Node.
                inline: ['@zmkfirmware/zmk-studio-ts-client'],
            },
        },
    },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src/renderer/src'),
            '@firmware': path.resolve(__dirname, './src/firmware'),
            '@shared': path.resolve(__dirname, './src/shared'),
            'protobufjs/minimal': 'protobufjs/minimal.js',
        },
    },
})
