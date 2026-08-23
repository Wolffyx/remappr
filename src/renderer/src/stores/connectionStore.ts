// pattern-check: skip mechanical drop-field codemod — removes RpcConnection from store; service is the sole connection handle
// Pattern check: no GoF pattern (-) — rejected — additive zustand store slice for keyCatalog; existing store already exists, no abstraction needed.
import { create, StateCreator } from 'zustand'
import { devtools } from 'zustand/middleware'
import type { KeyCatalog } from '@firmware/catalog/types'
import type { KeyboardService } from '@firmware/service'
import type { LockState } from '@firmware/types'
import useDynamicCatalogStore from '@/stores/dynamicCatalogStore'
import useConfigStore from '@/stores/configStore'
import useLayerSelectionStore from '@/stores/layerSelectionStore'
import useKeymapStore from '@/stores/keymapStore'
import useLightingCatalogStore from '@/stores/lightingCatalogStore'
import { createOsBackedKeyTest } from '@/features/keymap/keyboard/stage/osBackedKeyTest'

// Teardown for the connected keyboard's default-layer subscription (Feature 1).
// Module-scoped: the store is a singleton, and this keeps the internal handle off
// the public ConnectionState surface.
let defaultLayerUnsub: (() => void) | null = null

// Last hardware default layer we applied to the editor selection. Keychron
// boards re-push the same `default-layer` frame (it rides the state-notify
// stream, not just DIP toggles), and blindly following every push yanked the
// user back to the hardware layer whenever they picked another one. Only an
// actual change of the hardware value moves the selection.
let lastHwDefaultLayer: number | null = null

// Teardown for the config-store re-seed subscription. Module-scoped like
// defaultLayerUnsub, for the same reason.
let configReseedUnsub: (() => void) | null = null

// Seed (and later re-seed, via reseedConfigIfStale) the config store's
// source-of-truth from the device. getConfigSource returns COMMITTED truth
// (staged edits excluded), so running this after a commit mirrors the
// just-pushed blob into the export/builder views (which read
// useConfigStore.config); the isCurrent guard drops a resolution that lands
// after a service swap. No getConfigSource (QMK/VIA) → clear to null.
function seedConfigFromService(
    service: KeyboardService,
    isCurrent: () => boolean,
): void {
    if (!service.getConfigSource) {
        useConfigStore.getState().reset()
        return
    }
    service
        .getConfigSource()
        .then((src) => {
            if (!isCurrent()) return
            if (src) useConfigStore.getState().loadFromSource(src)
            else useConfigStore.getState().reset()
        })
        .catch((err) => {
            console.warn('getConfigSource failed', err)
            if (isCurrent()) useConfigStore.getState().reset()
        })
}

interface ConnectionState {
    service: KeyboardService | null
    /** When viewing a behind-dongle node, the dongle's own service — stashed so
     *  the editor can return to it. The node view shares the dongle's RPC, so we
     *  never disconnect this while swapping; `returnToParent` restores it and
     *  `disconnect` tears it down (the node view's own disconnect is a no-op). */
    parentService: KeyboardService | null
    /** Short-id of the node currently being viewed (null on the dongle / a direct
     *  device); drives the active-node check in the device menu. */
    activeNodeId: number | null
    communication: 'serial' | 'ble' | 'hid' | null
    deviceName: string | null
    lockState: LockState
    keyCatalog: KeyCatalog | null
    connectionAbort: AbortController
    /** Identity of the listed device being connected — bridges connect → preview capture. */
    lastConnectedDevice: { id: string; label: string } | null
    setService: (
        service: KeyboardService | null,
        communication?: 'serial' | 'ble' | 'hid',
    ) => void
    setLastConnectedDevice: (
        device: { id: string; label: string } | null,
    ) => void
    setDeviceName: (name: string | null) => void
    setLockState: (state: LockState) => void
    setKeyCatalog: (catalog: KeyCatalog | null) => void
    setConnectionAbort: (abort: AbortController) => void
    resetConnection: () => void
    showConnectionModal: boolean
    setShowConnectionModal: (visible: boolean) => void
    /** Re-seed configStore from the device if a save landed since the last seed
     *  (configStore.stale). Called by freshness-sensitive consumers (Download
     *  modal, Builder) right before they read — keeps the post-save hot path free
     *  of the full device config read. */
    reseedConfigIfStale: () => void
    /** Open a read-only view of a behind-dongle node and make it the active
     *  service, stashing the current (dongle) service as `parentService`. */
    openNode: (id: number) => Promise<void>
    /** Return from a node view to the stashed dongle service. No-op off a node. */
    returnToParent: () => void
    disconnect: () => Promise<void>
}

const connectionMiddleware =
    (config: StateCreator<ConnectionState>): StateCreator<ConnectionState> =>
    (set, get, api) =>
        config(
            (args, replace) => {
                const next = args as Partial<ConnectionState>
                if ('service' in next) {
                    set({ showConnectionModal: next.service === null })
                }
                set(args, replace as false | undefined)
            },
            get,
            api,
        )

const useConnectionStore = create<ConnectionState>()(
    devtools(
        connectionMiddleware((set, get) => ({
            service: null,
            parentService: null,
            activeNodeId: null,
            communication: null,
            deviceName: null,
            lockState: 'locked' as LockState,
            keyCatalog: null,
            connectionAbort: new AbortController(),
            lastConnectedDevice: null,
            setService: (service, communication) => {
                // Leaving every device (service → null, e.g. an onClosed from a
                // dropped dongle transport) also drops any node-view back-pointer,
                // so a later reconnect can't read a stale dongle as the node roster
                // source. Swaps to a node view pass a non-null service and skip this.
                if (!service) set({ parentService: null, activeNodeId: null })
                // A demo device has no switch matrix, so give it an
                // OS-event-backed keyTest facade — Key Test then works in demo
                // through the same path real hardware would, and the Header gate
                // (service.keyTest) shows the button only here, not on firmwares
                // that lack a matrix channel.
                if (service && service.capabilities.demo && !service.keyTest) {
                    service.keyTest = createOsBackedKeyTest(() => {
                        const keymap = useKeymapStore.getState().keymap
                        if (!keymap) return null
                        return {
                            layouts: keymap.layouts,
                            keymap,
                            selectedLayerIndex:
                                useLayerSelectionStore.getState()
                                    .selectedLayerIndex,
                            selectedPhysicalLayoutIndex: keymap.activeLayoutId,
                        }
                    })
                }
                set({ service, communication: communication ?? null })
                // Guard against stale async writes: if the user disconnects or
                // connects a different device before any of the awaited reads
                // below resolve, the resolved value belongs to the PREVIOUS
                // service and must not overwrite the current store (e.g. the old
                // device's keyCatalog/config clobbering the new one, or undoing a
                // reset). Every async callback re-checks the live service first.
                const isCurrent = (): boolean => get().service === service
                // Diagnostics: which adapter connected + which facades attached.
                if (service)
                    console.info('[connect] service', {
                        firmware: service.deviceInfo.firmware,
                        firmwareVersion: service.deviceInfo.firmwareVersion,
                        rgb: !!service.rgb,
                        wireless: !!service.wireless,
                        advanced: !!service.advanced,
                        layerControl: !!service.layerControl,
                    })
                // Feature 1: auto-select the keyboard's hardware default layer
                // (e.g. Keychron Mac/Win DIP) and follow live toggles. Adapters
                // without a `layers` facade leave the editor's selection alone.
                defaultLayerUnsub?.()
                defaultLayerUnsub = null
                // Seed the RGB effect list from a previously imported/cached board
                // definition's lighting menu (real per-board effect names).
                useLightingCatalogStore.getState().setCatalog(null)
                if (service) {
                    try {
                        const cached = service.sideload?.readCached?.()
                        if (cached?.lightingCatalog !== undefined)
                            useLightingCatalogStore
                                .getState()
                                .setCatalog(cached.lightingCatalog)
                    } catch (err) {
                        console.warn('lighting-menu seed failed', err)
                    }
                }
                lastHwDefaultLayer = null
                if (service?.layerControl) {
                    const applyHwLayer = (n: number): void => {
                        if (n === lastHwDefaultLayer) return
                        lastHwDefaultLayer = n
                        useLayerSelectionStore
                            .getState()
                            .setSelectedLayerIndex(n)
                    }
                    service.layerControl
                        .getDefaultLayer()
                        .then((n) => {
                            if (isCurrent()) applyHwLayer(n)
                        })
                        .catch((err) =>
                            console.warn('getDefaultLayer failed', err),
                        )
                    defaultLayerUnsub =
                        service.layerControl.onDefaultLayerChanged(applyHwLayer)
                }
                if (service?.listKeyCatalog) {
                    service
                        .listKeyCatalog()
                        .then((catalog) => {
                            if (isCurrent()) set({ keyCatalog: catalog })
                        })
                        .catch((err) => {
                            console.warn('listKeyCatalog failed', err)
                            if (isCurrent()) set({ keyCatalog: null })
                        })
                } else {
                    set({ keyCatalog: null })
                }
                // Dynamic catalog (macro/combo overlay tiles) is NOT seeded
                // here: its per-index reads are N+M serialized RPCs. The
                // key-action picker calls ensureLoaded on first open instead;
                // a null service still clears stale entries immediately.
                if (!service) {
                    useDynamicCatalogStore
                        .getState()
                        .refresh(null)
                        .catch((err) =>
                            console.warn('dynamicCatalog clear failed', err),
                        )
                }
                // Seed the config source-of-truth from the device once on
                // connect. After that, every commit / discard (Header save, the
                // debounced autosave, config-blob editor modals — each lands a
                // pending-changes true→false edge) only MARKS the config stale;
                // the actual re-read runs on demand (reseedConfigIfStale) when a
                // freshness-sensitive view opens. Re-reading eagerly here queued
                // a full device config read behind every save and stalled the
                // next edit on the serialized RPC channel.
                configReseedUnsub?.()
                configReseedUnsub = null
                if (service) {
                    seedConfigFromService(service, isCurrent)
                    if (service.getConfigSource) {
                        configReseedUnsub = service.onPendingChangesChanged(
                            (pending) => {
                                if (!pending && isCurrent())
                                    useConfigStore.getState().markStale()
                            },
                        )
                    }
                } else {
                    useConfigStore.getState().reset()
                }
            },
            reseedConfigIfStale: () => {
                const { service } = get()
                if (!service?.getConfigSource) return
                if (!useConfigStore.getState().stale) return
                const isCurrent = (): boolean => get().service === service
                seedConfigFromService(service, isCurrent)
            },
            setLastConnectedDevice: (device) =>
                set({ lastConnectedDevice: device }),
            setDeviceName: (name) => set({ deviceName: name }),
            setLockState: (state) => set({ lockState: state }),
            setKeyCatalog: (catalog) => set({ keyCatalog: catalog }),
            setConnectionAbort: (abort) => set({ connectionAbort: abort }),
            openNode: async (id) => {
                // The node roster lives on the dongle. When already viewing a node
                // the dongle is the stashed parent; otherwise it's the live service.
                const { service, parentService, communication } = get()
                const dongle = parentService ?? service
                if (!dongle?.nodes) return
                // Relayed read of the node's device-info + active config (may throw
                // on an offline node); only swap once it resolves. The returned view
                // shares the dongle's RPC, so we keep the dongle alive as parent.
                const view = await dongle.nodes.open(id)
                set({
                    parentService: dongle,
                    activeNodeId: id,
                    deviceName: view.deviceInfo.name,
                })
                get().setService(view, communication ?? undefined)
            },
            returnToParent: () => {
                const { parentService, communication } = get()
                if (!parentService) return
                // Clear before the swap so setService's null-guard can't fight it.
                set({
                    parentService: null,
                    activeNodeId: null,
                    deviceName: parentService.deviceInfo.name,
                })
                get().setService(parentService, communication ?? undefined)
            },
            resetConnection: () => {
                defaultLayerUnsub?.()
                defaultLayerUnsub = null
                lastHwDefaultLayer = null
                configReseedUnsub?.()
                configReseedUnsub = null
                useLightingCatalogStore.getState().setCatalog(null)
                set({
                    service: null,
                    parentService: null,
                    activeNodeId: null,
                    communication: null,
                    deviceName: null,
                    lockState: 'locked' as LockState,
                    keyCatalog: null,
                    // Clear the connect→preview-capture bridge so a stale id from
                    // the prior device can't key the next session's snapshot
                    // (e.g. demo mode overwriting a real keyboard's preview).
                    lastConnectedDevice: null,
                })
                useDynamicCatalogStore.getState().reset()
                useConfigStore.getState().reset()
            },
            showConnectionModal: false,
            setShowConnectionModal: (visible) =>
                set({ showConnectionModal: visible }),
            disconnect: async () => {
                const {
                    service,
                    parentService,
                    connectionAbort,
                    resetConnection,
                } = get()
                if (!service) {
                    return
                }

                try {
                    await service.disconnect()
                } catch (error) {
                    console.warn('Failed to disconnect service cleanly', error)
                }

                // On a node view, `service.disconnect()` is a no-op on the shared
                // dongle transport — tear the dongle down too so it doesn't leak.
                if (parentService && parentService !== service) {
                    try {
                        await parentService.disconnect()
                    } catch (error) {
                        console.warn(
                            'Failed to disconnect parent service cleanly',
                            error,
                        )
                    }
                }

                connectionAbort.abort('User disconnected')
                resetConnection()
                set({ connectionAbort: new AbortController() })
            },
        })),
    ),
)

export default useConnectionStore
