// Pattern check: no GoF pattern (-) — rejected — thin hook wiring a keymap-store
// subscription to a raise-into-config side effect; no abstraction.
//
// Behind-the-scenes config sync: the visual editor mutates the runtime keymap
// buffer (keymapStore); this raises each change back into the config (the source
// of truth the download modal compiles from), MERGING so config-only features
// the runtime can't model (lighting/macros/…) are preserved.
//
// Runs for any firmware whose adapter exposes a configBridge — i.e. one whose
// runtime projects from a config it also holds. Adapters that edit the device
// directly omit the facade and this hook does nothing for them.
import { useEffect } from 'react'
import useConnectionStore from '@/stores/connectionStore'
import useConfigStore from '@/stores/configStore'
import useKeymapStore from '@/stores/keymapStore'

export function useConfigRuntimeSync(): void {
    useEffect(() => {
        return useKeymapStore.subscribe((state, prev) => {
            const keymap = state.keymap
            if (!keymap || keymap === prev.keymap) return
            const bridge = useConnectionStore.getState().service?.configBridge
            if (!bridge) return
            const config = useConfigStore.getState().config
            if (!config) return
            useConfigStore
                .getState()
                .setConfig(bridge.raiseKeymap(keymap.layers, config))
        })
    }, [])
}
