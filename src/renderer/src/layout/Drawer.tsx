import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useLayout } from '@/hooks/use-layouts'
import { PhysicalLayoutPicker } from '@/features/keymap/layout-picker/PhysicalLayoutPicker'
import { LayerPicker } from '@/features/keymap/layer-picker/LayerPicker'
import { KeyTypeLegend } from '@/features/keymap/keyboard/KeyTypeLegend'
import undoRedoStore from '@/stores/undoRedoStore'
import useConnectionStore from '@/stores/connectionStore'
import useLayerSelectionStore from '@/stores/layerSelectionStore'
import useKeymapStore from '@/stores/keymapStore'
import { Keyboard } from 'lucide-react'
import { SidebarGroup } from '@/ui/sidebar'
import { LayoutSelect } from '@/features/keymap/layout-picker/LayoutSelect'
import { EditorSidebar } from '@/features/sidebar/EditorSidebar'
import useUserSettingsStore from '@/stores/userSettingsStore'
import { useFeatureAvailable } from '@/features/firmware/useFeatureAvailable'
// pattern-check: skip — drop dead lock guards now that App-shell render-gates locked state
import type { Keymap } from '@firmware/types'
import { produce } from 'immer'

// Pattern check: no GoF pattern (-) — rejected — the keyboard editor's slots handed to the shared EditorSidebar; data wiring only.
export function Drawer(): JSX.Element {
    // Field-scoped selectors: a bare useXStore() subscribes to the whole store
    // and re-renders the sidebar on every unrelated field change (lock state,
    // key catalog, undo/redo stack pushes…).
    const service = useConnectionStore((s) => s.service)
    // Read-only (behind-dongle node) views disable every layer-editing affordance.
    const editable = useFeatureAvailable('editable')
    const setSelectedLayerIndex = useLayerSelectionStore(
        (s) => s.setSelectedLayerIndex,
    )
    const keymap = useKeymapStore((s) => s.keymap)
    const setKeymap = useKeymapStore((s) => s.setKeymap)
    const resetKeymap = useKeymapStore((s) => s.resetKeymap)
    const {
        layouts,
        selectedPhysicalLayoutIndex,
        setSelectedPhysicalLayoutIndex,
    } = useLayout()
    const doIt = undoRedoStore((s) => s.doIt)

    // Adapter for LayerPicker - converts immer-style updater to store-compatible function
    const layerPickerSetKeymap = useMemo(
        () => (updater: (draft: Keymap) => void) => {
            setKeymap((prev: Keymap | undefined): Keymap | undefined => {
                if (!prev) return prev
                return produce(prev, updater)
            })
        },
        [setKeymap],
    )

    // Fetch keymap when service changes
    useEffect(() => {
        if (!service) {
            resetKeymap()
            return
        }

        let ignore = false

        async function fetchKeymap(): Promise<void> {
            if (!service) return
            try {
                const km = await service.getKeymap()
                if (!ignore) setKeymap(km)
            } catch (e) {
                console.error('Failed to fetch keymap', e)
            }
        }

        fetchKeymap()
        return (): void => {
            ignore = true
        }
    }, [service, setKeymap, resetKeymap])

    // Reset the layer selection whenever the service is swapped
    useEffect(() => {
        setSelectedLayerIndex(0)
    }, [service, setSelectedLayerIndex])

    const doSelectPhysicalLayout = useCallback(
        (i: number): void => {
            const oldLayout = selectedPhysicalLayoutIndex
            doIt?.(async (): Promise<() => Promise<void>> => {
                setSelectedPhysicalLayoutIndex(i)

                return async (): Promise<void> => {
                    setSelectedPhysicalLayoutIndex(oldLayout)
                }
            })
        },
        [doIt, selectedPhysicalLayoutIndex, setSelectedPhysicalLayoutIndex],
    )

    // Guarded by (service, index): the `layouts` array gets a fresh identity on
    // every layout-changed refetch, which used to re-issue the RPC (and replace
    // the keymap) without the selection actually changing.
    const appliedLayoutRef = useRef<{ svc: unknown; idx: number } | null>(null)
    useEffect(() => {
        if (!service || !layouts) return
        if (
            appliedLayoutRef.current?.svc === service &&
            appliedLayoutRef.current.idx === selectedPhysicalLayoutIndex
        ) {
            return
        }
        appliedLayoutRef.current = {
            svc: service,
            idx: selectedPhysicalLayoutIndex,
        }

        void (async () => {
            try {
                const km = await service.setActivePhysicalLayout(
                    selectedPhysicalLayoutIndex,
                )
                setKeymap(km)
            } catch (e) {
                console.error('Failed to set active physical layout', e)
            }
        })()
    }, [service, layouts, selectedPhysicalLayoutIndex, setKeymap])

    const layoutPicker = useUserSettingsStore((s) => s.layoutPicker)
    const scrollLayers = useUserSettingsStore((s) => s.layerList === 'scroll')
    const selectedLayerIndex = useLayerSelectionStore(
        (s) => s.selectedLayerIndex,
    )
    const deviceName = useConnectionStore((s) => s.deviceName)
    const communication = useConnectionStore((s) => s.communication)

    const identity = useMemo(
        () => ({
            name: deviceName?.trim() || service?.deviceInfo.name || 'Keyboard',
            summary: [
                'Keyboard',
                service?.deviceInfo.firmware,
                communication === 'ble' ? 'Bluetooth' : 'USB',
            ]
                .filter(Boolean)
                .join(' · '),
            icon: Keyboard,
        }),
        [deviceName, service, communication],
    )

    const foldItems = useMemo(
        () =>
            (keymap?.layers ?? []).map((l, i) => ({
                id: l.id,
                label: String(i),
                name: l.name || `Layer ${i}`,
                active: i === selectedLayerIndex,
                select: (): void => setSelectedLayerIndex(i),
            })),
        [keymap, selectedLayerIndex, setSelectedLayerIndex],
    )

    // One layout needs no picker; several get the select (or the old list).
    const LayoutPicker =
        layoutPicker === 'select' ? LayoutSelect : PhysicalLayoutPicker
    const header =
        layouts && layouts.length > 1 ? (
            <LayoutPicker
                layouts={layouts}
                selectedPhysicalLayoutIndex={selectedPhysicalLayoutIndex}
                onPhysicalLayoutClicked={doSelectPhysicalLayout}
            />
        ) : null

    return (
        <EditorSidebar
            identity={identity}
            header={header}
            legend={{ label: 'Key types', body: <KeyTypeLegend /> }}
            foldItems={foldItems}
        >
            <SidebarGroup
                data-coach="layers"
                className={scrollLayers ? 'min-h-0 flex-1' : undefined}
            >
                {keymap && (
                    <LayerPicker
                        layers={keymap.layers}
                        keymap={keymap}
                        setKeymap={layerPickerSetKeymap}
                        editable={editable}
                        scroll={scrollLayers}
                        canAdd={editable && (keymap.availableLayers || 0) > 0}
                        canRemove={editable && (keymap.layers?.length || 0) > 1}
                    />
                )}
            </SidebarGroup>
        </EditorSidebar>
    )
}
