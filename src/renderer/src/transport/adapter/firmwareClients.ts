// Pattern check: no GoF pattern (-) — rejected — module-level memoized lazy loader over a Vite glob; no class or polymorphism.
//
// Lazy, auto-discovering loader for the firmware-client barrels.
//
// Each `@firmware/<client>/index.ts` runs `registerAdapter()` as an import side
// effect. We used to list those imports by hand in main.tsx; instead we glob
// them so a new client dir is picked up with zero wiring. `import.meta.glob`
// (without `eager`) also code-splits every client into its own chunk, so they
// load on demand at connect time rather than bloating the initial bundle.
//
// Load order is intentionally NOT relied upon: see ./discovery.ts, which sorts
// adapters by an explicit priority so Remappr's HID filter still wins the
// single-filter Electron discovery regardless of which chunk resolves first.

// `src/firmware` also holds non-adapter support modules that ship their own
// index.ts (catalog = pure data, config = keymap compilers). Importing those
// here would be wrong — config would eagerly register every compiler at connect
// time. They are the only two such dirs; everything else matched below is a
// client. A new non-adapter dir with an index.ts must be added here.
import { initRemapprIdentity } from '@/lib/remapprIdentity'

const NON_CLIENT_DIRS = new Set(['catalog', 'config'])

const clientModules = import.meta.glob('@firmware/*/index.ts')

// Glob keys look like '@firmware/zmk/index.ts' or an absolute path depending on
// the resolver; either way the client dir is the segment before '/index.ts'.
function clientDir(globKey: string): string {
    return globKey.match(/\/([^/]+)\/index\.ts$/)?.[1] ?? ''
}

// [globKey, lazyImport] pairs for the adapter barrels only (support dirs filtered out).
function clientEntries(): [string, () => Promise<unknown>][] {
    return Object.entries(clientModules).filter(
        ([key]) => !NON_CLIENT_DIRS.has(clientDir(key)),
    )
}

/**
 * Names of the client dirs the glob will load — i.e. every `@firmware/<dir>`
 * with an index.ts, minus the non-adapter support dirs. Pure: evaluating the
 * glob keys does NOT execute the client modules, so this is safe to call without
 * triggering registration or pulling client deps.
 */
export function discoverableClientDirs(): string[] {
    return clientEntries().map(([key]) => clientDir(key))
}

let loadOnce: Promise<void> | null = null

/**
 * Import every firmware-client barrel (registering its adapter) exactly once.
 * Idempotent and memoized — concurrent and repeat callers share the same load.
 * Call this before anything that reads the adapter registry (discovery filters,
 * pickAdapter). The mock/demo path does not need it: `connectMock` bypasses the
 * registry.
 */
export function ensureFirmwareClientsLoaded(): Promise<void> {
    if (loadOnce) return loadOnce
    // Inject the durable Remappr control-auth identity store alongside the client
    // chunk loads: every connect path awaits this gate, so the identity is warm
    // before the first loadOrCreateIdentity() (else the §19 handshake regenerates
    // it each launch → ERR_AUTH on a bonded node). See lib/remapprIdentity.ts.
    loadOnce = Promise.all([
        ...clientEntries().map(([, load]) => load()),
        initRemapprIdentity(),
    ]).then(() => undefined)
    return loadOnce
}
