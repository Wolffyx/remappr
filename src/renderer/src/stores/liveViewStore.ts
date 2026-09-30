// Pattern check: no GoF pattern (-) — rejected — session-only zustand boolean toggle;
// lifts live-view flag so the toolbar toggle and the keyboard stage share one
// source of truth. No abstraction warranted.
import { create } from 'zustand'
import { devtools } from 'zustand/middleware'

/**
 * Live-view toggle: when enabled, the keyboard stage flashes simulated/real keypresses
 * and shows the pulsing LIVE indicator. Lifted out of KeyboardView local state so the
 * header toolbar's Live (zap) toggle can drive it.
 *
 * Off at the start of every session, and not persisted: live view is something
 * to switch on while checking a board, not a standing mode.
 */
interface LiveViewState {
    enabled: boolean
    setEnabled: (enabled: boolean) => void
    toggle: () => void
}

const useLiveViewStore = create<LiveViewState>()(
    devtools((set) => ({
        enabled: false,
        setEnabled: (enabled) => set({ enabled }),
        toggle: () => set((s) => ({ enabled: !s.enabled })),
    })),
)

export default useLiveViewStore
