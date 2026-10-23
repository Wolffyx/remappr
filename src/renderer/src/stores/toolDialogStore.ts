// pattern-check: skip — one-field store: which toolbar dialog is open
//
// Every toolbar style (labelled, compact, menus, search, launcher) opens the
// same dialogs, and the ⌘ palette does too. The open dialog lives here so the
// dialogs mount once (layout/toolbar/ToolDialogs) instead of once per style.
import { create } from 'zustand'

interface ToolDialogState {
    /** Tool id of the open dialog, or null. */
    open: string | null
    openDialog: (id: string) => void
    close: () => void
}

const useToolDialogStore = create<ToolDialogState>()((set) => ({
    open: null,
    openDialog: (open) => set({ open }),
    close: () => set({ open: null }),
}))

export default useToolDialogStore
