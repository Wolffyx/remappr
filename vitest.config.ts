import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
    test: {
        globals: true,
        environment: 'node',
        include: ['src/**/*.test.ts', 'scripts/**/*.test.ts'],
        deps: {
            // Handle ESM/CJS interop issues
            interopDefault: true,
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
