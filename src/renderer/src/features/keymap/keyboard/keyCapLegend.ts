// Pattern check: no GoF pattern (-) — rejected — a shared structural props/data
// contract (the legend fields KeyButton renders); type-only, no abstraction or
// polymorphism warranted.
//
// The single source of truth for "what a keycap shows". Two feeders produce it:
//   • the EDITOR — device KeyAction → resolveBindingLabels + categoryForBinding
//   • the BUILDER — deviceless CanonAction → builderCapProps
// Both converge on this shape; KeyButtonProps extends it with layout/interaction
// fields, and the builder's CapLegend narrows it (tapText/category required). This
// keeps the two parallel feeders honest without routing one through the other's
// data model (see builderCapProps + lib/keymap/keyCategory).
import type { HoldTapLabels } from './HoldTapKeyLabel'
import type { KeyCategory } from '@/lib/keymap/keyCategory'
import type { LegendPart } from '@firmware/paramLabel'

export type { HoldTapLabels }

export interface KeyCapLegend {
    /** Action-type tag shown top-left (e.g. "Key Press", "Layer-Tap"). */
    header?: string
    /** The tap glyph text (e.g. "Q", "Vol+") — also sizes the main legend
     * (≤1 char → 0.46U, ≤3 → 0.34U, else 0.24U). Distinct from {@link header}. */
    tapText?: string
    /** Composite icon+text legend parts (behavior icon [+ command]). When set
     * with a resolvable icon, KeyButton renders these as the main legend instead
     * of {@link tapText}/children; {@link tapText} still drives cap sizing. Used
     * by the builder feeder; the editor feeds the same via `children`. */
    tapParts?: LegendPart[]
    /** Full, untruncated value for the hover tooltip (e.g. "ErrorUndefined"
     *  when {@link tapText} is the abbreviated glyph). Falls back to tapText. */
    valueTitle?: string
    /** Firmware binding code (e.g. "&kp" / "KC") shown as the header in
     *  "Binding code" display mode. */
    actionLabel?: string
    /** Tap + hold legend pair for a tap-hold key. Mutually exclusive with {@link mods}. */
    holdTap?: HoldTapLabels
    /** Modifier names for a CHORD (e.g. ["Ctrl","Shift"]) — rendered as chips
     *  stacked above the legend, joined by "+". Mutually exclusive with {@link holdTap}. */
    mods?: string[]
    /** Shifted dual-legend symbol (e.g. "!") shown small in the top-right corner. */
    shift?: string
    /** Face (cap-fill) category — tints the cap, the dot and the tap legend. */
    category?: KeyCategory
    /**
     * Accent (function) category — colours the header tag + hold legend only.
     * For a home-row mod this is `mod` while {@link category} stays `alpha`, so
     * the cap face is neutral and only the text is accented (design behaviour).
     * Defaults to {@link category} when omitted.
     */
    accentCategory?: KeyCategory
}
