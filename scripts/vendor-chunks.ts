// Pattern check: no GoF pattern (-) — rejected — pure build-config helper
// mapping module ids to chunk names; no runtime abstraction warranted.
// Shared Rollup `manualChunks` for vite.config.ts (web) and
// electron.vite.config.ts (renderer). Groups the heavyweight vendors into
// their own cacheable chunks; matches by path substring so copies resolved
// from the symlinked @remappr/* siblings' node_modules land in the same
// chunk as the app's.
export function vendorChunks(id: string): string | undefined {
    // Vite's dynamic-import preload helper (and Rollup's CommonJS helpers) are
    // shared by every lazy import. Unassigned, Rollup folded them into the
    // monaco chunk, so the entry statically imported 4 MB of Monaco on start.
    if (id.includes('vite/preload-helper') || id.includes('commonjsHelpers'))
        return 'runtime-helpers'
    if (!id.includes('node_modules')) return undefined
    // Monaco is only reachable through the lazy JSON-config panel — keep every
    // monaco module in one async chunk instead of smearing it across chunks.
    if (id.includes('monaco')) return 'monaco'
    if (/node_modules\/(react|react-dom|scheduler)\//.test(id)) {
        return 'react-vendor'
    }
    if (
        id.includes('react-aria') ||
        id.includes('react-stately') ||
        id.includes('@internationalized')
    ) {
        return 'aria-vendor'
    }
    if (id.includes('@radix-ui')) return 'radix-vendor'
    return undefined
}
