// Pattern check: no GoF pattern (-) — rejected — additive zustand store slice for per-index macro/combo label overlays, mirrors existing connectionStore shape, no abstraction.
//
// Holds device-derived (auto) and user-defined (override) labels for
// each macro slot, plus the firmware's macro / combo behaviors as tiles.
// Picker tabs read this store to enrich the static MC_*/DM_* tiles with
// the user's real names ("Open Slack" instead of "M0"). The future macros
// editor writes here after committing changes via service.macros.setMacro,
// then calls refresh() — picker re-renders automatically through the
// zustand subscription.
import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import type { CatalogEntry } from '@firmware/catalog/types'
import type { KeyboardService } from '@firmware/service'

interface DynamicLabel {
    label: string
    description?: string
}

interface DynamicCatalogState {
    // Auto-derived from the device's macro contents (Vial). Wiped on
    // disconnect.
    macroOverlays: Record<number, DynamicLabel>
    // User-defined names — future editor writes here. Take precedence
    // over overlays when present.
    macroLabels: Record<number, string>
    // ZMK runtime macro / combo behaviors as catalog tiles. Each entry
    // carries `behaviorRef` so the picker emits a complete KeyAction
    // (kind = behavior id, params = []) instead of a codec-encoded
    // number. Empty on QMK / Vial / Keychron — those use the static
    // MACROS_ENTRIES + COMBOS_ENTRIES tiles.
    extraMacroEntries: CatalogEntry[]
    extraComboEntries: CatalogEntry[]
    // Display-only combo tiles parsed from a side-loaded ZMK .keymap
    // file. Tiles render in the Combos page with displayOnly=true so
    // the picker shows a toast instead of dispatching a binding when
    // clicked (no firmware path exists to assign a combo to a key).
    sideloadedComboEntries: CatalogEntry[]
    setMacroLabel: (idx: number, label: string) => void
    setSideloadedComboEntries: (entries: CatalogEntry[]) => void
    refresh: (svc: KeyboardService | null) => Promise<void>
    // Lazy variant of refresh: seeds the overlays/tiles once per service, on
    // first demand (key-action picker open) instead of on connect — the
    // per-index macro reads are N serialized RPCs that would otherwise
    // sit on the connect path for tiles the user may never open.
    ensureLoaded: (svc: KeyboardService | null) => Promise<void>
    reset: () => void
}

// Which service the store was last seeded for (and which seed is in flight) —
// module scope like connectionStore's subscription handles; the store is a
// singleton.
let seededFor: KeyboardService | null = null
let seedingFor: KeyboardService | null = null

const useDynamicCatalogStore = create<DynamicCatalogState>()(
    devtools((set, get) => ({
        macroOverlays: {},
        macroLabels: {},
        extraMacroEntries: [],
        extraComboEntries: [],
        sideloadedComboEntries: [],
        setMacroLabel: (idx, label) =>
            set((s) => ({ macroLabels: { ...s.macroLabels, [idx]: label } })),
        setSideloadedComboEntries: (sideloadedComboEntries) =>
            set({ sideloadedComboEntries }),
        refresh: async (svc) => {
            if (!svc) {
                seededFor = null
                seedingFor = null
                set({
                    macroOverlays: {},
                    extraMacroEntries: [],
                    extraComboEntries: [],
                })
                return
            }
            const [macros, behaviorEntries] = await Promise.all([
                fetchMacroOverlays(svc),
                fetchBehaviorEntries(svc),
            ])
            set({
                macroOverlays: macros,
                extraMacroEntries: behaviorEntries.macros,
                extraComboEntries: behaviorEntries.combos,
            })
        },
        ensureLoaded: async (svc) => {
            if (!svc || seededFor === svc || seedingFor === svc) return
            seedingFor = svc
            try {
                await get().refresh(svc)
                seededFor = svc
            } catch (err) {
                console.warn('dynamicCatalog ensureLoaded failed', err)
            } finally {
                if (seedingFor === svc) seedingFor = null
            }
        },
        reset: () => {
            seededFor = null
            seedingFor = null
            set({
                macroOverlays: {},
                macroLabels: {},
                extraMacroEntries: [],
                extraComboEntries: [],
                sideloadedComboEntries: [],
            })
        },
    })),
)

async function fetchMacroOverlays(
    svc: KeyboardService,
): Promise<Record<number, DynamicLabel>> {
    const out: Record<number, DynamicLabel> = {}
    if (svc.macros) {
        const count = svc.macros.getCount()
        for (let i = 0; i < count; i++) {
            try {
                const actions = await svc.macros.getMacro(i)
                const text = actions
                    .map((a) =>
                        a.kind === 'text' && typeof a.text === 'string'
                            ? a.text
                            : '',
                    )
                    .join('')
                    .trim()
                if (text) out[i] = { label: text.slice(0, 16) }
            } catch (err) {
                console.warn(`getMacro(${i}) failed`, err)
            }
        }
    }
    return out
}

// Walks listActionTypes() and splits user-defined &macro_* / &combo_*
// behaviors into Macros / Combos catalog tiles. Each tile carries
// behaviorRef = { kind: actionType.id } so the picker can emit a
// complete KeyAction (kind, params: []) on click instead of going
// through codec.encode. ZMK populates these; QMK / Vial / Keychron
// return empty since vial:macro is no longer an action type and QMK
// macros / combos are catalog-tile-only by construction.
async function fetchBehaviorEntries(svc: KeyboardService): Promise<{
    macros: CatalogEntry[]
    combos: CatalogEntry[]
}> {
    try {
        // A firmware whose macro pool is key-assignable reports its macro NAMES
        // and, per index, the exact binding a click should emit (macroRef). Then
        // one named tile per macro is built straight from the pool, bypassing
        // behavior classification, and the keycap shows the macro's real name.
        // Firmwares whose macros are behaviors (ZMK) implement neither and fall
        // through to the listActionTypes path below.
        const macroNames = svc.macros?.listNames?.()
        const macroRef = svc.macros?.macroRef
        if (macroNames && macroNames.length > 0 && macroRef) {
            const macros = macroNames.map(
                (name, index): CatalogEntry => ({
                    id: `macro.pool.${index}`,
                    label: name,
                    name,
                    description: `Macro: ${name}`,
                    kinds: ['hid'],
                    behaviorRef: macroRef.call(svc.macros, index),
                }),
            )
            return { macros, combos: [] }
        }

        const types = await svc.listActionTypes()
        const { classifyBehavior } =
            await import('@/lib/keymap/behaviorClassify')
        const { subsumedBehaviorIds } =
            await import('@/features/actions/keyActionPickerUtils')
        // Skip behaviors a composite type folds in (e.g. a /mouse/i macro the
        // unified Mouse dropdown already lists) so they don't double-list as tiles.
        const subsumed = subsumedBehaviorIds(types)
        const macros: CatalogEntry[] = []
        const combos: CatalogEntry[] = []
        for (const at of types) {
            if (subsumed.has(at.id)) continue
            const cls = classifyBehavior(at)
            if (cls === 'other') continue
            // A behavior the firmware can't bind (settable: false — e.g. a ZMK
            // parameterized macro reporting zero metadata sets; the device
            // rejects every setLayerBinding with INVALID_PARAMETERS) still
            // shows as a tile, but display-only with an explanatory toast
            // instead of a doomed RPC.
            const unsettable = at.settable === false
            const entry: CatalogEntry = {
                id: `${cls}.behavior.${at.id}`,
                label: at.displayName,
                name: at.displayName,
                description: at.description,
                kinds: ['hid'],
                ...(at.icon ? { icon: at.icon } : {}),
                ...(unsettable
                    ? {
                          displayOnly: true,
                          displayOnlyNote: `${at.displayName} takes parameters the firmware doesn't describe over the wire, so it can't be assigned from here — bind it in your .keymap instead.`,
                      }
                    : { behaviorRef: { kind: at.id } }),
            }
            if (cls === 'macro') macros.push(entry)
            else combos.push(entry)
        }
        return { macros, combos }
    } catch (err) {
        console.warn('fetchBehaviorEntries failed', err)
        return { macros: [], combos: [] }
    }
}

export default useDynamicCatalogStore
