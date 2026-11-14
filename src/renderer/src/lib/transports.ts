// Pattern check: Strategy (Tier 1) — extended — registry-backed env dispatch replaces inline builder table
/**
 * Thin entry point for the transport system.
 *
 * Adapters self-register via `registerTransport()` at module load. The
 * side-effect imports below pull each adapter family into the bundle and
 * trigger registration. `getTransports()` then walks the registry,
 * filters by current env, and returns the public-facing factories.
 *
 * Add a new transport by creating a new adapter module under
 * `src/renderer/src/<env>/<kind>.ts` (or `transport/web-*.ts`), calling
 * `registerTransport({...})` at module load, and adding the side-effect
 * import here.
 */

import { getAdapters } from '@firmware/registry'
import type { TransportFactory } from '../transport/types'
import { detectEnv, isElectron } from '../transport/adapter/env'
import {
    getRegisteredTransports,
    subscribeAllChanges,
} from '../transport/adapter/registry'

// Side-effect imports — each adapter module calls registerTransport()
import '../electron/serial'
import '../electron/ble'
import '../electron/hid'
import '../transport/web-serial'
import '../transport/web-hid'
// Web Bluetooth disabled in browser builds — keep file referenced via
// build-time import resolution but don't register a descriptor.
import '../transport/web-ble'

export { isElectron }

// Keyed by how many firmware adapters have registered. A transport's create()
// reads their discovery filters (Electron HID returns null with none), and the
// clients load lazily, so a list built before they registered must not stick
// (L4.25). Adapters only ever register, so the count is a valid key.
let cached: { adapterCount: number; transports: TransportFactory[] } | null =
    null

export function getTransports(): TransportFactory[] {
    const adapterCount = getAdapters().length
    if (cached?.adapterCount !== adapterCount) {
        cached = {
            adapterCount,
            transports: getRegisteredTransports(detectEnv()),
        }
    }
    return cached.transports
}

export function subscribeToTransportChanges(cb: () => void): () => void {
    return subscribeAllChanges(detectEnv(), cb)
}
