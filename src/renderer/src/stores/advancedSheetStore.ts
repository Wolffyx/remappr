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
    toggle: () => void
    setSection: (section: AdvancedSheetSection) => void
}

const useAdvancedSheetStore = create<AdvancedSheetState>()(
    devtools((set) => ({
        open: false,
        section: 'macros',
        setOpen: (open) => set({ open }),
        openAt: (section) => set({ open: true, section }),
        toggle: () => set((s) => ({ open: !s.open })),
        setSection: (section) => set({ section }),
    })),
)

export default useAdvancedSheetStore
