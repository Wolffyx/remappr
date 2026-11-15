// Pattern check: no GoF pattern (-) — rejected — derive active tab instead of set-state-in-effect, single-hook refactor
import { useEffect, useMemo, useState } from 'react'
import { CATALOG_PAGES } from '@firmware/catalog/pages'
import type {
    CatalogEntry,
    CatalogPage,
    KeyCatalog,
} from '@firmware/catalog/types'
import type { FirmwareBehaviorFlags } from '@firmware/service'
import useConnectionStore from '@/stores/connectionStore'
import useDynamicCatalogStore from '@/stores/dynamicCatalogStore'
import { filterKeysBySearch } from '@/lib/keymap/keycodeGrid'

// Canonical-id prefixes whose tiles are gated by Capabilities.behaviors.
// Adapter that explicitly sets the flag to `false` hides the family;
// `undefined` means unspecified → treat as supported (backward compat).
// The behavior-family flags (a keyboard built without combos, macros, …) gate
// the tiles that family's firmware code serves.
const BEHAVIOR_PREFIX_GATES: ReadonlyArray<{
    flag: keyof FirmwareBehaviorFlags
    prefix: string
}> = [
    { flag: 'capsWord', prefix: 'caps_word.' },
    { flag: 'leader', prefix: 'leader.' },
    { flag: 'autoShift', prefix: 'auto_shift.' },
    { flag: 'swapHands', prefix: 'swap_hands.' },
    { flag: 'tapHold', prefix: 'auto_shift.' },
    { flag: 'combos', prefix: 'combo.' },
    { flag: 'macros', prefix: 'macro.' },
    { flag: 'sequences', prefix: 'leader.' },
    { flag: 'unicode', prefix: 'unicode.' },
    { flag: 'keyOverrides', prefix: 'key_override.' },
]

/** Drop the tiles of every behavior the adapter flags `false`. A page left
 *  empty by that (e.g. Macros on a keyboard built without macros) goes too. */
export const filterPagesByBehaviorFlags = (
    pages: CatalogPage[],
    flags: FirmwareBehaviorFlags | undefined,
): CatalogPage[] => {
    if (!flags) return pages
    const disabled = BEHAVIOR_PREFIX_GATES.filter(
        ({ flag }) => flags[flag] === false,
    )
    if (disabled.length === 0) return pages
    return pages.flatMap((p) => {
        const entries = p.entries.filter(
            (e) => !disabled.some(({ prefix }) => e.id.startsWith(prefix)),
        )
        if (entries.length === 0 && p.entries.length > 0) return []
        return [{ ...p, entries }]
    })
}

// Enrich Macros-page tiles with the user's real macro names from the
// dynamic catalog store (Vial macro contents, future editor labels).
// Patches label (tile face), name (tooltip heading), and notes (tooltip
// description) so the device-derived label flows all the way into the
// hover surface — not just the grid button. Falls through unchanged
// when no overlay exists for an idx.
const enrichMacroEntries = (
    entries: CatalogEntry[],
    state: Pick<
        ReturnType<typeof useDynamicCatalogStore.getState>,
        'macroOverlays' | 'macroLabels'
    >,
): CatalogEntry[] =>
    entries.map((e) => {
        const m = e.id.match(/^macro\.user\.(\d+)$/)
        if (!m) return e
        const idx = Number(m[1])
        const overlay = state.macroOverlays[idx]
        const userLabel = state.macroLabels[idx]
        const labelOverride = userLabel ?? overlay?.label
        const descOverride = overlay?.description
        if (!labelOverride && !descOverride) return e
        return {
            ...e,
            label: labelOverride ?? e.label,
            name: labelOverride ?? e.name,
            notes: descOverride ?? e.notes,
        }
    })

// pattern-check: skip mechanical extension — third optional sideloadedCombos arg merged into Combos page
// Append ZMK runtime &macro_* / &combo_* behavior tiles to the
// Macros / Combos pages, plus side-loaded display-only combos parsed
// from an imported ZMK .keymap file. ZMK is the only adapter that
// produces runtime behavior tiles; QMK / Vial / Keychron pass empty
// runtime arrays. The sideloaded array is independent — present on
// any adapter once the user uploads a .keymap. On ZMK the codec
// doesn't support the static MC_* / COMBO_TOG ids so
// filterCatalogByCodec drops the pages entirely — synthesize them
// here when extras exist.
const mergeBehaviorEntries = (
    base: CatalogPage[],
    extraMacros: CatalogEntry[],
    extraCombos: CatalogEntry[],
    sideloadedCombos: CatalogEntry[] = [],
): CatalogPage[] => {
    const allCombos = [...sideloadedCombos, ...extraCombos]
    if (extraMacros.length === 0 && allCombos.length === 0) return base
    let hasMacros = false
    let hasCombos = false
    const merged = base.map((p) => {
        if (p.id === 'macros') {
            hasMacros = true
            return extraMacros.length > 0
                ? { ...p, entries: [...extraMacros, ...p.entries] }
                : p
        }
        if (p.id === 'combos') {
            hasCombos = true
            return allCombos.length > 0
                ? { ...p, entries: [...allCombos, ...p.entries] }
                : p
        }
        return p
    })
    if (!hasMacros && extraMacros.length > 0) {
        merged.push({
            id: 'macros',
            name: 'Macros',
            style: 'flat-grid',
            visible: true,
            entries: extraMacros,
        })
    }
    if (!hasCombos && allCombos.length > 0) {
        merged.push({
            id: 'combos',
            name: 'Combos',
            style: 'flat-grid',
            visible: true,
            entries: allCombos,
        })
    }
    return merged
}

interface UseKeycodeFilterResult {
    searchQuery: string
    setSearchQuery: (q: string) => void
    activeTab: string
    setActiveTab: (t: string) => void
    pages: CatalogPage[]
    pagesWithMatches: { index: number; hasMatches: boolean }[]
}

// pattern-check: skip additive optional catalog-override param on existing hook
export function useKeycodeFilter(
    catalogOverride?: KeyCatalog,
): UseKeycodeFilterResult {
    const [searchQuery, setSearchQuery] = useState('')
    const [userTab, setUserTab] = useState('0')
    const storeCatalog = useConnectionStore((s) => s.keyCatalog)
    const keyCatalog = catalogOverride ?? storeCatalog
    const behaviorFlags = useConnectionStore(
        (s) => s.service?.capabilities.behaviors,
    )
    const service = useConnectionStore((s) => s.service)
    // Seed the macro/combo overlay tiles on first picker open (once per
    // service) — deferred off the connect path, see dynamicCatalogStore.
    useEffect(() => {
        void useDynamicCatalogStore.getState().ensureLoaded(service)
    }, [service])
    // pattern-check: skip — mechanical zustand slice-selector scoping, no abstraction
    // Slice-scoped selectors: subscribing to the whole dynamic-catalog store
    // both re-rendered every picker host and busted the `pages` memo on any
    // unrelated field change (combo labels, overlays being wiped, …).
    const macroOverlays = useDynamicCatalogStore((s) => s.macroOverlays)
    const macroLabels = useDynamicCatalogStore((s) => s.macroLabels)
    const extraMacroEntries = useDynamicCatalogStore((s) => s.extraMacroEntries)
    const extraComboEntries = useDynamicCatalogStore((s) => s.extraComboEntries)
    const sideloadedComboEntries = useDynamicCatalogStore(
        (s) => s.sideloadedComboEntries,
    )

    const pages: CatalogPage[] = useMemo(() => {
        const base = keyCatalog?.pages ?? CATALOG_PAGES
        // Gate after the merge so device-derived macro / combo tiles hide with
        // their family too.
        const merged = mergeBehaviorEntries(
            base,
            extraMacroEntries,
            extraComboEntries,
            sideloadedComboEntries,
        )
        return filterPagesByBehaviorFlags(merged, behaviorFlags).map((p) =>
            p.id === 'macros'
                ? {
                      ...p,
                      entries: enrichMacroEntries(p.entries, {
                          macroOverlays,
                          macroLabels,
                      }),
                  }
                : p,
        )
    }, [
        keyCatalog,
        behaviorFlags,
        macroOverlays,
        macroLabels,
        extraMacroEntries,
        extraComboEntries,
        sideloadedComboEntries,
    ])

    const pagesWithMatches = useMemo(() => {
        return pages.map((page, index) => {
            const filtered = filterKeysBySearch(page.entries, searchQuery)
            return { index, hasMatches: filtered.length > 0 }
        })
    }, [pages, searchQuery])

    const activeTab = useMemo(() => {
        const userIndex = parseInt(userTab)
        const maxIndex = pages.length - 1
        const clamped = Math.min(Math.max(0, userIndex), Math.max(0, maxIndex))
        if (!searchQuery.trim()) return clamped.toString()
        const current = pagesWithMatches[clamped]
        if (current?.hasMatches) return clamped.toString()
        const firstMatch = pagesWithMatches.find((k) => k.hasMatches)
        return (firstMatch?.index ?? clamped).toString()
    }, [userTab, searchQuery, pagesWithMatches, pages.length])

    return {
        searchQuery,
        setSearchQuery,
        activeTab,
        setActiveTab: setUserTab,
        pages,
        pagesWithMatches,
    }
}
