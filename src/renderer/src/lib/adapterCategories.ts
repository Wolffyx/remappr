// Pattern check: no GoF pattern (-) — rejected — registry aggregation helpers
// (dedup, sort, match); the polymorphism already lives in FirmwareAdapter.
//
// The connection settings let the user pick a firmware FAMILY, not an individual
// adapter — several adapters share one (qmk-via, qmk-vial and keychron-qmk are
// all "QMK"). That list used to be a hardcoded union of firmware names in the
// app; now each adapter declares its own category and these helpers derive the
// picker from whatever is registered. Adding a firmware needs no app change.
import { getAdapters } from '@firmware/registry'
import type { AdapterCategoryInfo, FirmwareAdapter } from '@firmware/adapter'

export type { AdapterCategoryInfo }

/** Every distinct category among the registered adapters, in declared order.
 *  Adapters with no category (the demo mock) are not user-selectable families. */
export function adapterCategories(): AdapterCategoryInfo[] {
    const byId = new Map<string, AdapterCategoryInfo>()
    for (const adapter of getAdapters()) {
        const category = adapter.category
        if (category && !byId.has(category.id)) byId.set(category.id, category)
    }
    return [...byId.values()].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
}

/** The adapters belonging to one category. */
export function adaptersInCategory(id: string | null): FirmwareAdapter[] {
    if (!id) return []
    return getAdapters().filter((a) => a.category?.id === id)
}

/** The stored preference if that category still exists, else the first one, else
 *  null (nothing registered yet — the clients load lazily). */
export function resolveCategory(stored: string | null): string | null {
    const all = adapterCategories()
    if (all.length === 0) return null
    if (stored && all.some((c) => c.id === stored)) return stored
    return all[0].id
}

export function categoryInfo(id: string | null): AdapterCategoryInfo | null {
    return adapterCategories().find((c) => c.id === id) ?? null
}

/**
 * Which family a connected device belongs to, from the firmware family string it
 * reports. Matched against the registry rather than a name table: an exact
 * adapter id first, then a category id, then an adapter whose id contains the
 * family (so a device reporting `vial` lands on `qmk-vial`'s category).
 * Null when nothing matches — including the demo mock, which declares no
 * category and so must not move the user's preference.
 */
export function categoryForFirmware(
    firmware: string | null | undefined,
): string | null {
    if (!firmware) return null
    const adapters = getAdapters()
    const exact = adapters.find((a) => a.id === firmware)
    if (exact?.category) return exact.category.id
    const byCategory = adapters.find((a) => a.category?.id === firmware)
    if (byCategory?.category) return byCategory.category.id
    const contains = adapters.find((a) => a.category && a.id.includes(firmware))
    return contains?.category?.id ?? null
}
