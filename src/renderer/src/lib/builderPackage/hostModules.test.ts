// pattern-check: skip — keeps the host module table in sync with the builder
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { HOST_MODULES } from './hostModules'

const builderDir = fileURLToPath(
    new URL('../../features/builder', import.meta.url),
)
// The builder is optional: a build without its repo links a stub.
const hasBuilder = existsSync(join(builderDir, 'Builder.tsx'))

function sources(dir: string): string[] {
    return readdirSync(dir).flatMap((name) => {
        const path = join(dir, name)
        if (statSync(path).isDirectory())
            return name.startsWith('.') ? [] : sources(path)
        return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : []
    })
}

/** Same rule as the builder's package build (src/package/hostModules.ts). */
function isHostModule(spec: string): boolean {
    if (
        /^(react|react-dom)(\/|$)|^(sonner|lucide-react|monaco-editor|@monaco-editor\/react)$/.test(
            spec,
        )
    )
        return true
    if (/^(zustand|@firmware)(\/|$)|^@shared\//.test(spec)) return true
    return spec.startsWith('@/') && !spec.startsWith('@/features/builder')
}

describe.skipIf(!hasBuilder)('builder host modules', () => {
    it('provides every module the builder imports from the host', () => {
        const specs = new Set<string>()
        for (const file of sources(builderDir)) {
            // Type-only imports are erased by the build; they need no module.
            const text = readFileSync(file, 'utf8').replace(
                /^import type [\s\S]*?from '[^']+'/gm,
                '',
            )
            for (const m of text.matchAll(/(?:from|import\()\s*'([^']+)'/g))
                if (isHostModule(m[1])) specs.add(m[1])
        }
        // The scan found the builder's imports at all.
        expect(specs.size).toBeGreaterThan(20)
        const missing = [...specs].filter((s) => !(s in HOST_MODULES)).sort()
        expect(missing).toEqual([])
    })
})
