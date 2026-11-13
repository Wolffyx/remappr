// pattern-check: skip — unit tests for the manifest check
import { describe, expect, it } from 'vitest'
import { manifestProblem, type PackageManifest } from './loader'

const manifest = (over: Partial<PackageManifest> = {}): PackageManifest => ({
    name: 'remappr-builder',
    version: '1.0.0',
    hostApi: '^1',
    hostModules: ['react'],
    files: [],
    ...over,
})

describe('manifestProblem', () => {
    it('accepts a package for this host API whose modules are provided', () => {
        expect(manifestProblem(manifest(), 1, { react: 1 })).toBeNull()
    })

    it('refuses another host API or a missing module', () => {
        expect(
            manifestProblem(manifest({ hostApi: '^2' }), 1, { react: 1 }),
        ).toMatch(/host API/)
        expect(
            manifestProblem(manifest({ hostApi: '>=1' }), 1, { react: 1 }),
        ).toMatch(/host API/)
        expect(
            manifestProblem(manifest({ hostModules: ['react', '@/x'] }), 1, {
                react: 1,
            }),
        ).toBe('needs modules this app does not provide: @/x')
    })
})
