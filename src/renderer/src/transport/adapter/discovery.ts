// Pattern check: Strategy (Tier 1) — applied — pluggable discovery providers per communication kind
// Import from the narrow registry/adapter modules rather than the '@firmware'
// barrel: the barrel re-exports transport-client symbols that pull heavy deps,
// and this file only needs the adapter list + type.
import { getAdapters } from '@firmware/registry'
import type { FirmwareAdapter } from '@firmware/adapter'

// Single-filter discovery (the Electron HID path) uses the FIRST adapter that
// declares a filter. With lazy/parallel client loading the registration order
// is nondeterministic, so we can't rely on "import Remappr first" anymore — pin
// the winner by priority instead. Remappr is this app's primary firmware and
// must own the HID vendor filter (0x1209 / usage page 0xFF00).
const ADAPTER_PRIORITY: Record<string, number> = { remappr: 100 }

function adaptersByPriority(): readonly FirmwareAdapter[] {
    return [...getAdapters()].sort(
        (a, b) => (ADAPTER_PRIORITY[b.id] ?? 0) - (ADAPTER_PRIORITY[a.id] ?? 0),
    )
}

export interface BleDiscovery {
    serviceUuid: string
    charUuid: string
}

export interface HidDiscovery {
    vendorIds?: number[]
    usagePage?: number
    usage?: number
}

export interface HidFilter {
    vendorId?: number
    productId?: number
    usagePage?: number
    usage?: number
}

export function bleDiscovery(): BleDiscovery | null {
    for (const adapter of adaptersByPriority()) {
        const ble = adapter.discovery.ble
        if (ble) return { serviceUuid: ble.serviceUuid, charUuid: ble.charUuid }
    }
    return null
}

export function hidDiscovery(): HidDiscovery | null {
    for (const adapter of adaptersByPriority()) {
        const hid = adapter.discovery.hid
        if (hid) {
            return {
                vendorIds: hid.vendorIds,
                usagePage: hid.usagePage,
                usage: hid.usage,
            }
        }
    }
    return null
}

// pattern-check: skip — thin aggregator over the adapter registry, sibling of
// hidDiscovery/hidFilters; no GoF abstraction (the file's Strategy already covers it).
// Every registered adapter's HID filter, highest-priority first. The Electron
// HID path enumerates against ALL of them (match-any) so non-primary firmwares
// (QMK/VIA, Keychron) still surface — distinct usage pages (Remappr 0xFF00, VIA
// 0xFF60, …) can't collapse into one filter, so they travel as a list.
export function hidDiscoveryAll(): HidDiscovery[] {
    const out: HidDiscovery[] = []
    for (const adapter of adaptersByPriority()) {
        const hid = adapter.discovery.hid
        if (!hid) continue
        out.push({
            vendorIds: hid.vendorIds,
            usagePage: hid.usagePage,
            usage: hid.usage,
        })
    }
    return out
}

// WebHID requestDevice() takes a filters array — emit one filter per
// registered adapter so all firmware variants surface in the chooser.
export function hidFilters(): HidFilter[] {
    const out: HidFilter[] = []
    for (const adapter of adaptersByPriority()) {
        const hid = adapter.discovery.hid
        if (!hid) continue
        const vids =
            hid.vendorIds && hid.vendorIds.length > 0
                ? hid.vendorIds
                : [undefined]
        for (const vendorId of vids) {
            out.push({
                vendorId,
                usagePage: hid.usagePage,
                usage: hid.usage,
            })
        }
    }
    return out
}
