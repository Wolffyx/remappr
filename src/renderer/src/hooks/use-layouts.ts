// pattern-check: skip mechanical port — useLayout now reads from service.getPhysicalLayouts() and uses neutral PhysicalLayout
import type { PhysicalLayout } from '@firmware/types'
import { Dispatch, SetStateAction, useEffect, useState } from 'react'
import useConnectionStore from '@/stores/connectionStore'

interface UseLayoutsReturn {
    layouts: PhysicalLayout[] | undefined
    selectedPhysicalLayoutIndex: number
    setSelectedPhysicalLayoutIndex: Dispatch<SetStateAction<number>>
}

export function useLayout(): UseLayoutsReturn {
    const service = useConnectionStore((s) => s.service)

    const [layouts, setLayouts] = useState<PhysicalLayout[] | undefined>(
        undefined,
    )
    const [selectedPhysicalLayoutIndex, setSelectedPhysicalLayoutIndex] =
        useState<number>(0)

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
    }, [service])

    return {
        layouts,
        selectedPhysicalLayoutIndex,
        setSelectedPhysicalLayoutIndex,
    }
}
