// pattern-check: skip — persisted zustand store of the screen texts, no logic
//
// The texts this computer shows on a device's screens (the host values
// user0..user15, "Text 1".."Text 16" in the display editor). Kept on this
// computer, pushed by the host feed while a device shows them.
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

interface HostTextState {
    /** By host key name (`user0`...). */
    texts: Record<string, string>
    setText: (key: string, text: string) => void
}

const useHostTextStore = create<HostTextState>()(
    persist(
        (set) => ({
            texts: {},
            setText: (key, text) =>
                set((s) => ({ texts: { ...s.texts, [key]: text } })),
        }),
        {
            name: 'host-text-store',
            storage: createJSONStorage(() => localStorage),
        },
    ),
)

export default useHostTextStore
