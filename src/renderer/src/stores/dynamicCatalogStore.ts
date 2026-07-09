// Pattern check: no GoF pattern (-) — rejected — additive zustand store slice for per-index macro/combo label overlays, mirrors existing connectionStore shape, no abstraction.
//
// Holds device-derived (auto) and user-defined (override) labels for
// each macro / combo slot. Picker tabs read this store to enrich the
// static MC_*/DM_*/COMBO_* tiles with the user's real names ("Open
// Slack" instead of "M0"). The future macros/combos editor menu
// writes here after committing changes via service.macros.setMacro /
// service.dynamic.setCombo, then calls refresh() — picker re-renders
// automatically through the zustand subscription.
import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import type { CatalogEntry } from '@firmware/catalog/types'
import type { KeyboardService } from '@firmware/service'
import { REMAPPR_KIND_MACRO } from '@firmware/remappr/actions'

interface DynamicLabel {
    label: string
    description?: string
}

interface DynamicCatalogState {
    // Auto-derived from device on connect (Vial macro contents, ZMK
    // &macro_* / &combo_* behavior names). Wiped on disconnect.
    macroOverlays: Record<number, DynamicLabel>
    comboOverlays: Record<number, DynamicLabel>
    // User-defined names — future editor writes here. Take precedence
    // over overlays when present.
    macroLabels: Record<number, string>
    comboLabels: Record<number, string>
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
    setMacroOverlays: (next: Record<number, DynamicLabel>) => void
    setComboOverlays: (next: Record<number, DynamicLabel>) => void
    setMacroLabel: (idx: number, label: string) => void
    setComboLabel: (idx: number, label: string) => void
    setSideloadedComboEntries: (entries: CatalogEntry[]) => void
    refresh: (svc: KeyboardService | null) => Promise<void>
    reset: () => void
}

const useDynamicCatalogStore = create<DynamicCatalogState>()(
    devtools((set) => ({
        macroOverlays: {},
        comboOverlays: {},
        macroLabels: {},
        comboLabels: {},
        extraMacroEntries: [],
        extraComboEntries: [],
        sideloadedComboEntries: [],
        setMacroOverlays: (macroOverlays) => set({ macroOverlays }),
        setComboOverlays: (comboOverlays) => set({ comboOverlays }),
        setMacroLabel: (idx, label) =>
            set((s) => ({ macroLabels: { ...s.macroLabels, [idx]: label } })),
        setComboLabel: (idx, label) =>
            set((s) => ({ comboLabels: { ...s.comboLabels, [idx]: label } })),
        setSideloadedComboEntries: (sideloadedComboEntries) =>
            set({ sideloadedComboEntries }),
        refresh: async (svc) => {
            if (!svc) {
                set({
                    macroOverlays: {},
                    comboOverlays: {},
                    extraMacroEntries: [],
                    extraComboEntries: [],
                })
                return
            }
            const [macros, combos, behaviorEntries] = await Promise.all([
                fetchMacroOverlays(svc),
                fetchComboOverlays(svc),
                fetchBehaviorEntries(svc),
            ])
            set({
                macroOverlays: macros,
                comboOverlays: combos,
                extraMacroEntries: behaviorEntries.macros,
                extraComboEntries: behaviorEntries.combos,
            })
        },
        reset: () =>
            set({
                macroOverlays: {},
                comboOverlays: {},
                macroLabels: {},
                comboLabels: {},
                extraMacroEntries: [],
                extraComboEntries: [],
                sideloadedComboEntries: [],
            }),
    })),
)

// Resolve the display label for a macro index — user override beats
// device-derived overlay beats the static slot's own label.
export const resolveMacroLabel = (
    idx: number,
    state: DynamicCatalogState,
    fallback: string,
): string =>
    state.macroLabels[idx] ?? state.macroOverlays[idx]?.label ?? fallback

export const resolveComboLabel = (
    idx: number,
    state: DynamicCatalogState,
    fallback: string,
): string =>
    state.comboLabels[idx] ?? state.comboOverlays[idx]?.label ?? fallback

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

async function fetchComboOverlays(
    svc: KeyboardService,
): Promise<Record<number, DynamicLabel>> {
    const out: Record<number, DynamicLabel> = {}
    const counts = svc.dynamic?.getCounts()
    if (svc.dynamic && counts && counts.combo > 0) {
        for (let i = 0; i < counts.combo; i++) {
            try {
                const entry = await svc.dynamic.getCombo(i)
                const activeKeys = entry.keys.filter((k) => k !== 0).length
                if (entry.output !== 0 && activeKeys >= 2) {
                    out[i] = {
                        label: `Combo ${i}`,
                        description: `${activeKeys}-key combo`,
                    }
                }
            } catch (err) {
                console.warn(`getCombo(${i}) failed`, err)
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
        // Remappr §24: the config blob's named macros are key-assignable but
        // aren't ZMK behaviors, so build one named tile per macro directly from
        // the pool (bypassing classifyBehavior). The tile's behaviorRef carries
        // the pool index, so a picker click binds REMAPPR_KIND_MACRO with
        // params=[index] and the keycap shows the macro's real name. Other
        // families don't implement listNames → fall through to the ZMK path.
        const macroNames = svc.macros?.listNames?.()
        if (macroNames && macroNames.length > 0) {
            const macros = macroNames.map(
                (name, index): CatalogEntry => ({
                    id: `macro.remappr.${index}`,
                    label: name,
                    name,
                    description: `Macro: ${name}`,
                    kinds: ['hid'],
                    behaviorRef: { kind: REMAPPR_KIND_MACRO, params: [index] },
                }),
            )
            return { macros, combos: [] }
        }

        const types = await svc.listActionTypes()
        const { classifyBehavior } =
            await import('@/lib/keymap/behaviorClassify')
        const macros: CatalogEntry[] = []
        const combos: CatalogEntry[] = []
        for (const at of types) {
            const cls = classifyBehavior(at)
            if (cls === 'other') continue
            const entry: CatalogEntry = {
                id: `${cls}.behavior.${at.id}`,
                label: at.displayName,
                name: at.displayName,
                description: at.description,
                kinds: ['hid'],
                behaviorRef: { kind: at.id },
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
