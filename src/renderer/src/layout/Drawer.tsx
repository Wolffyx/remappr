import { useCallback, useEffect, useMemo } from 'react'
import { useLayout } from '@/hooks/use-layouts'
import { PhysicalLayoutPicker } from '@/features/keymap/layout-picker/PhysicalLayoutPicker'
import { LayerPicker } from '@/features/keymap/layer-picker/LayerPicker'
import { KeyTypeLegend } from '@/features/keymap/keyboard/KeyTypeLegend'
import undoRedoStore from '@/stores/undoRedoStore'
import useConnectionStore from '@/stores/connectionStore'
import useLayerSelectionStore from '@/stores/layerSelectionStore'
import useKeymapStore from '@/stores/keymapStore'
import {
    Sidebar,
    SidebarContent,
    SidebarGroup,
    SidebarFooter,
} from '@/ui/sidebar'
import { DeviceMenu } from '@/features/connection/device-menu/DeviceMenu'
import { useFeatureAvailable } from '@/features/firmware/useFeatureAvailable'
// pattern-check: skip — drop dead lock guards now that App-shell render-gates locked state
import type { Keymap } from '@firmware/types'
import { produce } from 'immer'

// pattern-check: skip — mechanical lock-guard removal
export function Drawer(): JSX.Element {
    const { service } = useConnectionStore()
    // Read-only (behind-dongle node) views disable every layer-editing affordance.
    const editable = useFeatureAvailable('editable')
    const { setSelectedLayerIndex } = useLayerSelectionStore()
    const { keymap, setKeymap, resetKeymap } = useKeymapStore()
    const {
        layouts,
        selectedPhysicalLayoutIndex,
        setSelectedPhysicalLayoutIndex,
    } = useLayout()
    const { doIt } = undoRedoStore()

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

    useEffect(() => {
        if (!service || !layouts) return

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

    return (
        <Sidebar collapsible="offcanvas" variant="sidebar">
            <SidebarContent className="pt-2">
                <SidebarGroup>
                    {layouts && (
                        <PhysicalLayoutPicker
                            layouts={layouts}
                            selectedPhysicalLayoutIndex={
                                selectedPhysicalLayoutIndex
                            }
                            onPhysicalLayoutClicked={doSelectPhysicalLayout}
                        />
                    )}
                </SidebarGroup>
                <SidebarGroup data-coach="layers">
                    {keymap && (
                        <LayerPicker
                            layers={keymap.layers}
                            keymap={keymap}
                            setKeymap={layerPickerSetKeymap}
                            editable={editable}
                            canAdd={
                                editable && (keymap.availableLayers || 0) > 0
                            }
                            canRemove={
                                editable && (keymap.layers?.length || 0) > 1
                            }
                        />
                    )}
                </SidebarGroup>
                <SidebarGroup className="mt-auto">
                    <KeyTypeLegend />
                </SidebarGroup>
            </SidebarContent>
            <SidebarFooter>
                <DeviceMenu />
            </SidebarFooter>
        </Sidebar>
    )
}
