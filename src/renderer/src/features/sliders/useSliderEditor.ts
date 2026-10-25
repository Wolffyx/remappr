// Pattern check: Command (Tier 2) — extended — the do-then-return-undo closure undoRedoStore.doIt runs for key and encoder edits, for one slider binding.
//
// Slider edits for the binding editor: replace one layer's binding for the
// slider at a keymap position. The keymap updates before the device answers;
// a failed write puts it back and records no undo step.
import { useCallback } from 'react'
import { produce } from 'immer'
import { toast } from 'sonner'
import type { Keymap, SliderAction } from '@firmware/types'
import type { KeyboardService } from '@firmware/service'
import undoRedoStore from '@/stores/undoRedoStore'

interface Inputs {
    service: KeyboardService | undefined
    keymap: Keymap | undefined
    setKeymap: (fn: (prev: Keymap | undefined) => Keymap | undefined) => void
    layerIndex: number
}

export interface SliderEditor {
    /** False when the service can't write sliders (none, or read-only). */
    canEdit: boolean
    set: (keyIndex: number, next: SliderAction | null) => void
}

export function useSliderEditor({
    service,
    keymap,
    setKeymap,
    layerIndex,
}: Inputs): SliderEditor {
    const doIt = undoRedoStore((s) => s.doIt)
    const api = service?.capabilities.readOnly ? undefined : service?.sliders

    const set = useCallback(
        (keyIndex: number, next: SliderAction | null): void => {
            const layer = keymap?.layers[layerIndex]
            if (!api || !layer) return
            const before = layer.sliders?.[keyIndex] ?? null
            const apply = (s: SliderAction | null): void =>
                setKeymap((prev) =>
                    prev
                        ? produce(prev, (d) => {
                              const l = d.layers[layerIndex]
                              if (!l) return
                              const sliders = { ...l.sliders }
                              if (s) sliders[keyIndex] = s
                              else delete sliders[keyIndex]
                              l.sliders = sliders
                          })
                        : prev,
                )
            doIt(async () => {
                apply(next)
                try {
                    await api.setSlider(layer.id, keyIndex, next)
                } catch (e) {
                    apply(before)
                    toast.error('Failed to set the slider')
                    console.error('Failed to set the slider', e)
                    throw e
                }
                return async (): Promise<void> => {
                    apply(before)
                    await api.setSlider(layer.id, keyIndex, before)
                }
            })
        },
        [api, keymap, layerIndex, setKeymap, doIt],
    )

    return { canEdit: !!api, set }
}
