import { defineConfig } from 'eslint/config'
import tseslint from '@electron-toolkit/eslint-config-ts'
import eslintConfigPrettier from '@electron-toolkit/eslint-config-prettier'
import eslintPluginReact from 'eslint-plugin-react'
import eslintPluginReactHooks from 'eslint-plugin-react-hooks'
import eslintPluginReactRefresh from 'eslint-plugin-react-refresh'
import eslintPluginStorybook from 'eslint-plugin-storybook'
import eslintPluginJsxA11y from 'eslint-plugin-jsx-a11y'

export default defineConfig(
    {
        ignores: [
            '**/node_modules',
            '**/dist',
            '**/out',
            '**/out-types',
            '**/build',
            // Consumed @remappr/* sibling repos: symlinked into the app (firmware/
            // ui/builder) and the CI clone cache (.remappr). They are separate
            // repos with their own lint/CI — don't re-lint vendored source here.
            '**/.remappr',
            'src/firmware',
            'src/renderer/src/ui',
            'src/renderer/src/features/builder',
            // Build caches / local tooling artifacts.
            '**/.vitepress/cache',
            '.claude',
        ],
    },
    tseslint.configs.recommended,
    eslintPluginReact.configs.flat.recommended,
    eslintPluginReact.configs.flat['jsx-runtime'],
    eslintPluginJsxA11y.flatConfigs.recommended,
    eslintPluginStorybook.configs['flat/recommended'],
    {
        settings: {
            react: {
                version: 'detect',
            },
        },
    },
    {
        files: ['**/*.{ts,tsx}'],
        plugins: {
            'react-hooks': eslintPluginReactHooks,
            'react-refresh': eslintPluginReactRefresh,
        },
        rules: {
            ...eslintPluginReactHooks.configs.recommended.rules,
            ...eslintPluginReactRefresh.configs.vite.rules,
        },
    },
    {
        // lib/ must stay pure: no React, no Zustand, no I/O, no UI features.
        files: ['src/renderer/src/lib/**/*.{ts,tsx}'],
        rules: {
            'no-restricted-imports': [
                'error',
                {
                    patterns: [
                        {
                            group: [
                                'react',
                                'react-dom',
                                'zustand',
                                'zustand/*',
                                '@/services/*',
                                '@/stores/*',
                                '@/hooks/*',
                                '@/features/*',
                                '@/components/*',
                                '@/ui/*',
                            ],
                            message:
                                'lib/ is for pure logic only. Move React/Zustand/IO code to hooks/, services/, stores/, or features/.',
                        },
                    ],
                },
            ],
        },
    },
    {
        // The app consumes the GENERALIZED firmware system only. Every firmware
        // CLIENT lives under @firmware/clients/* and is off-limits here: its
        // parsers, protocol constants and behavior-kind values belong behind the
        // neutral seams (Capabilities, the optional service facades,
        // FirmwareAdapter + registry). Importing one re-couples the app to a
        // single firmware and defeats the adapter layer.
        //
        // One pattern covers every client, present and future, because the
        // firmware package keeps clients in their own namespace.
        files: ['src/renderer/**/*.{ts,tsx}', 'src/main/**/*.{ts,tsx}'],
        rules: {
            'no-restricted-imports': [
                'error',
                {
                    patterns: [
                        {
                            group: [
                                '@firmware/clients',
                                '@firmware/clients/**',
                            ],
                            message:
                                "Firmware-client internals are off-limits to the app. Import the neutral firmware system instead ('@firmware' barrel, or a neutral module such as @firmware/service, @firmware/types, @firmware/config). If the app needs firmware-specific behaviour, expose it through a capability flag or an optional service facade owned by the adapter.",
                        },
                    ],
                },
            ],
        },
    },
    {
        // Tests are the one place app code may name a concrete firmware client:
        // a contract test that asserts "the demo mock satisfies this neutral
        // gate" needs BOTH sides of the contract by definition. The ban above is
        // about the app's RUNTIME coupling, which a test does not create.
        files: [
            'src/renderer/**/*.test.{ts,tsx}',
            'src/main/**/*.test.{ts,tsx}',
        ],
        rules: {
            'no-restricted-imports': 'off',
        },
    },
    {
        // App CommonJS scripts (postinstall helpers) legitimately use require().
        files: ['**/*.cjs'],
        rules: {
            '@typescript-eslint/no-require-imports': 'off',
            '@typescript-eslint/explicit-function-return-type': 'off',
        },
    },
    eslintConfigPrettier,
)
