// pattern-check: skip mechanical port — useLayout now reads from service.getPhysicalLayouts() and uses neutral PhysicalLayout
import type { PhysicalLayout } from '@firmware/types'
import { Dispatch, SetStateAction, useEffect, useState } from 'react'
import { create } from 'zustand'
import useConnectionStore from '@/stores/connectionStore'

interface UseLayoutsReturn {
    layouts: PhysicalLayout[] | undefined
    selectedPhysicalLayoutIndex: number
    setSelectedPhysicalLayoutIndex: Dispatch<SetStateAction<number>>
}

// Pattern check: no GoF pattern (-) — rejected — bug fix: per-hook useState → the repo's zustand store idiom.
// The selected layout is shared by every useLayout caller: the sidebar picker
// changes it and the board (KeyboardView) must draw the same one. Per-hook
// state left the board on the first layout after a switch.
const useSelectedLayoutStore = create<{
    index: number
    setIndex: Dispatch<SetStateAction<number>>
}>()((set) => ({
    index: 0,
    setIndex: (next) =>
        set((s) => ({
            index: typeof next === 'function' ? next(s.index) : next,
        })),
}))

export function useLayout(): UseLayoutsReturn {
    const service = useConnectionStore((s) => s.service)

    const [layouts, setLayouts] = useState<PhysicalLayout[] | undefined>(
        undefined,
    )
    const selectedPhysicalLayoutIndex = useSelectedLayoutStore((s) => s.index)
    const setSelectedPhysicalLayoutIndex = useSelectedLayoutStore(
        (s) => s.setIndex,
    )

    useEffect((): void | (() => void) => {
        if (!service) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setLayouts(undefined)
            return
        }

        let isCancelled = false

        const fetchLayouts = async (resetSelected: boolean): Promise<void> => {
            try {
                const got = await service.getPhysicalLayouts()
                if (!isCancelled) {
                    setLayouts(got.layouts)
                    if (resetSelected) {
                        setSelectedPhysicalLayoutIndex(got.activeLayoutId)
                    }
                }
            } catch (error) {
                if (!isCancelled) {
                    console.error('Failed to fetch layouts:', error)
                    setLayouts(undefined)
                }
            }
        }

        setLayouts(undefined)

        const off = service.subscribe?.((n) => {
            if (n.topic === 'layout-changed') void fetchLayouts(false)
        })

        void fetchLayouts(true)

        return (): void => {
            isCancelled = true
            off?.()
        }
    }, [service, setSelectedPhysicalLayoutIndex])

    return {
        layouts,
        selectedPhysicalLayoutIndex,
        setSelectedPhysicalLayoutIndex,
    }
}
