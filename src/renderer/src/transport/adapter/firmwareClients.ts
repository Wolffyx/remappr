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

// Every firmware client lives under `@firmware/clients/`, so the glob targets
// exactly the adapter barrels — no filtering needed. This used to glob
// `@firmware/*/index.ts` and subtract a hand-maintained list of non-adapter
// support dirs (catalog, config), which silently mis-loaded any new one: config,
// for instance, would have eagerly registered every keymap compiler at connect.
import { prepareAdapters } from '@firmware/registry'
import { initHostSecretStore } from '@/lib/hostSecretStore'

const clientModules = import.meta.glob('@firmware/clients/*/index.ts')

// Glob keys look like '@firmware/clients/zmk/index.ts' or an absolute path
// depending on the resolver; either way the client dir is the segment before
// '/index.ts'.
function clientDir(globKey: string): string {
    return globKey.match(/\/([^/]+)\/index\.ts$/)?.[1] ?? ''
}

// [globKey, lazyImport] pairs for the adapter barrels.
function clientEntries(): [string, () => Promise<unknown>][] {
    return Object.entries(clientModules)
}

/**
 * Names of the client dirs the glob will load — every `@firmware/clients/<dir>`
 * with an index.ts. Pure: evaluating the glob keys does NOT execute the client
 * modules, so this is safe to call without triggering registration or pulling
 * client deps.
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
    // Hand the firmware system this app's durable secret backend BEFORE the
    // clients load, then let each registered adapter run its own `prepare`
    // warmup. Anything a client must pull from the host before its first
    // connect (e.g. Remappr's persisted §19 control-auth identity, which the
    // handshake would otherwise regenerate every launch → ERR_AUTH on an
    // already-bonded node) happens inside that client, not here.
    initHostSecretStore()
    loadOnce = Promise.all(clientEntries().map(([, load]) => load()))
        .then(() => prepareAdapters())
        .then(() => undefined)
    return loadOnce
}
