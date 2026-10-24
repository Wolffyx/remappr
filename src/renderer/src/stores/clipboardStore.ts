// pattern-check: skip mechanical zustand single-slot store mirroring existing keymapStore shape
// Pattern check: no GoF pattern (-) — rejected — single-slot clipboard for the right-click copy/paste flow on key tiles; mirrors existing zustand store shape, no abstraction.
import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import type { KeyAction } from '@firmware/types'

interface ClipboardState {
    action: KeyAction | null
    setAction: (action: KeyAction | null) => void
}

const useClipboardStore = create<ClipboardState>()(
    devtools((set) => ({
        action: null,
        setAction: (action) => set({ action }),
    })),
)

export default useClipboardStore
