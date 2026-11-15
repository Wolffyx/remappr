// pattern-check: skip — non-persisted zustand UI slice for the Advanced bottom sheet, mirrors rgbSheetStore
import { create } from 'zustand'
import { devtools } from 'zustand/middleware'

/**
 * Visibility + active section of the Advanced editing bottom sheet (dynamic
 * entries + macros). Lives in a store — not local state — so the Header's two
 * triggers (Sliders → dynamic, Sparkles → macros) and the KeymapEditor that
 * renders the sheet in the bottom dock stay decoupled. Exactly mirrors
 * rgbSheetStore; the two sheets are mutually exclusive in the dock. Session-only.
 */
export type AdvancedSheetSection = 'td' | 'combo' | 'ko' | 'ark' | 'macros'

interface AdvancedSheetState {
    open: boolean
    section: AdvancedSheetSection
    setOpen: (open: boolean) => void
    openAt: (section: AdvancedSheetSection) => void
    setSection: (section: AdvancedSheetSection) => void
}

const useAdvancedSheetStore = create<AdvancedSheetState>()(
    devtools((set) => ({
        open: false,
        section: 'td',
        setOpen: (open) => set({ open }),
        openAt: (section) => set({ open: true, section }),
        setSection: (section) => set({ section }),
    })),
)

export default useAdvancedSheetStore
