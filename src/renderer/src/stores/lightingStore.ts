// pattern-check: skip — persisted zustand sim-state store (liveViewStore's shape, minus persistence there)
import { create } from 'zustand'
import { createJSONStorage, devtools, persist } from 'zustand/middleware'
import {
    SIM_DEFAULTS,
    type SimLighting,
    type UnifiedLighting,
} from '@/features/lighting/engine'

/**
 * Editor/demo RGB-simulation state — the source the keyboard stage reflects live.
 *
 * The on-screen glow is ALWAYS a simulation (firmware doesn't report per-key
 * colours). When a keyboard is connected, `device` holds the config derived from
 * the keyboard's *readable* RGB settings (effect/hue/brightness/speed) and the
 * stage prefers it; with no device, the manual sim fields below drive the glow and
 * the RGB modal edits them. The manual fields persist ('remappr.rgb'); `device` is
 * session-only (re-read from the keyboard). The builder uses
 * config.keyboard.lighting instead; all feed one glow engine via adapters
 * (features/lighting/engine).
 */
interface LightingState extends SimLighting {
    /** Live config derived from the connected keyboard, or null when none. */
    device: UnifiedLighting | null
    setLighting: (patch: Partial<SimLighting>) => void
    setDevice: (device: UnifiedLighting | null) => void
    reset: () => void
}

const useLightingStore = create<LightingState>()(
    devtools(
        persist(
            (set) => ({
                ...SIM_DEFAULTS,
                device: null,
                setLighting: (patch) => set((s) => ({ ...s, ...patch })),
                setDevice: (device) => set({ device }),
                reset: () => set({ ...SIM_DEFAULTS }),
            }),
            {
                name: 'remappr.rgb',
                storage: createJSONStorage(() => localStorage),
                partialize: ({
                    effect,
                    bright,
                    speed,
                    hue,
                    sat,
                    perKey,
                    underglow,
                    backlight,
                }) => ({
                    effect,
                    bright,
                    speed,
                    hue,
                    sat,
                    perKey,
                    underglow,
                    backlight,
                }),
            },
        ),
    ),
)

export default useLightingStore
