// Pattern check: no GoF pattern (-) — rejected — thin hook binding the encoder command to the stores; one caller, no new abstraction.
//
// Encoder edits for the binding editor: set one direction, or swap the two.
// Both run encoderEditCommand through the undo store, against the layer the
// editor is showing.
import { useCallback, useMemo } from 'react'
import { produce } from 'immer'
import { toast } from 'sonner'
import type { EncoderAction, KeyAction, Keymap } from '@firmware/types'
import type { KeyboardService } from '@firmware/service'
import undoRedoStore from '@/stores/undoRedoStore'
import { encoderEditCommand, type EncoderPatch } from './encoderEditCommand'
import { ENCODER_DIRS, type EncoderSelection } from './model'

interface Inputs {
    service: KeyboardService | null
    keymap: Keymap | undefined
    setKeymap: (
        update: (prev: Keymap | undefined) => Keymap | undefined,
    ) => void
    layerIndex: number
}

export interface EncoderEditor {
    /** False when the service can't write encoders (none, or read-only). */
    canEdit: boolean
    setDirection: (sel: EncoderSelection, action: KeyAction) => void
    /** Reverse the encoder's direction order (CCW ↔ CW). */
    swap: (slot: number) => void
}

export function useEncoderEditor({
    service,
    keymap,
    setKeymap,
    layerIndex,
}: Inputs): EncoderEditor {
    const doIt = undoRedoStore((s) => s.doIt)
    const api = service?.capabilities.readOnly ? undefined : service?.encoders
    const canEdit = !!api

    const run = useCallback(
        (
            slot: number,
            patch: (before: EncoderAction) => EncoderPatch,
            failMsg: string,
        ): void => {
            const layer = keymap?.layers[layerIndex]
            const before = layer?.encoders?.[slot]
            if (!api || !layer || !before) return
            const command = encoderEditCommand({
                api,
                layerId: layer.id,
                slot,
                before,
                patch: patch(before),
                apply: (enc) =>
                    setKeymap((prev) =>
                        prev
                            ? produce(prev, (d) => {
                                  const encoders =
                                      d.layers[layerIndex]?.encoders
                                  if (encoders?.[slot]) encoders[slot] = enc
                              })
                            : prev,
                    ),
            })
            if (!command) return
            doIt(async () => {
                try {
                    return await command()
                } catch (e) {
                    toast.error(failMsg)
                    console.error(failMsg, e)
                    throw e
                }
            })
        },
        [api, keymap, layerIndex, setKeymap, doIt],
    )

    const setDirection = useCallback(
        (sel: EncoderSelection, action: KeyAction): void =>
            run(
                sel.slot,
                () => ({ [sel.dir]: action }),
                'Failed to set encoder action',
            ),
        [run],
    )

    const swap = useCallback(
        (slot: number): void =>
            run(
                slot,
                (before) => {
                    const dirs = ENCODER_DIRS.map((d) => d.dir)
                    const reversed = [...dirs].reverse()
                    return Object.fromEntries(
                        dirs.map((dir, i) => [dir, before[reversed[i]]]),
                    )
                },
                'Failed to swap encoder directions',
            ),
        [run],
    )

    return useMemo(
        () => ({ canEdit, setDirection, swap }),
        [canEdit, setDirection, swap],
    )
}
