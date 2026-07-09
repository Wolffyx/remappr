// Pattern check: no GoF pattern (-) — rejected — flat descriptor registry, declarative wiring of TransportFactory list
import type { TransportFactory } from '../types'
import type { Env } from './env'
import {
    bleDiscovery,
    hidDiscovery,
    hidDiscoveryAll,
    hidFilters,
    type BleDiscovery,
    type HidDiscovery,
    type HidFilter,
} from './discovery'

/**
 * Context passed to descriptors. Bundles the env tag plus the discovery
 * lookups so adapters never reach into firmware internals directly.
 */
export interface TransportContext {
    env: Env
    bleDiscovery: () => BleDiscovery | null
    hidDiscovery: () => HidDiscovery | null
    /** Every registered adapter's HID filter (Electron match-any enumeration). */
    hidDiscoveryAll: () => HidDiscovery[]
    hidFilters: () => HidFilter[]
}

/**
 * Each transport family registers one descriptor. `create` returns the
 * public-facing factory or null when the runtime gate fails (e.g. browser
 * without navigator.serial). `subscribeChanges` is optional and used for
 * USB/HID/BLE hotplug events.
 */
export interface TransportDescriptor {
    id: string
    envs: Env | Env[]

    create(ctx: TransportContext): TransportFactory | null

    subscribeChanges?(ctx: TransportContext, cb: () => void): () => void
}

const registry: TransportDescriptor[] = []

export function registerTransport(d: TransportDescriptor): void {
    if (registry.some((x) => x.id === d.id)) {
        throw new Error(`Transport descriptor "${d.id}" already registered`)
    }
    registry.push(d)
}

function matchesEnv(d: TransportDescriptor, env: Env): boolean {
    return Array.isArray(d.envs) ? d.envs.includes(env) : d.envs === env
}

export function buildContext(env: Env): TransportContext {
    return { env, bleDiscovery, hidDiscovery, hidDiscoveryAll, hidFilters }
}

export function getRegisteredTransports(env: Env): TransportFactory[] {
    const ctx = buildContext(env)
    const out: TransportFactory[] = []
    for (const d of registry) {
        if (!matchesEnv(d, env)) continue
        const f = d.create(ctx)
        if (f) out.push(f)
    }
    return out
}

export function subscribeAllChanges(env: Env, cb: () => void): () => void {
    const ctx = buildContext(env)
    const unsubs: Array<() => void> = []
    for (const d of registry) {
        if (!matchesEnv(d, env)) continue
        const u = d.subscribeChanges?.(ctx, cb)
        if (u) unsubs.push(u)
    }
    return (): void => unsubs.forEach((u) => u())
}
