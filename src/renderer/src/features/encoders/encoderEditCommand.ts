// Pattern check: Command (Tier 2) — extended — builds the do-then-return-undo closure that undoRedoStore.doIt already executes for key edits; set and swap become one command.
//
// One undoable encoder edit: write any subset of an encoder's directions.
// Setting one direction and swapping two are both just "these directions get
// these actions", so there is one write/rollback/undo path instead of a copy
// per gesture.
import type { EncoderAction, KeyAction } from '@firmware/types'
import type { EncoderApi } from '@firmware/service'
import type { DoCallback } from '@/stores/undoRedoStore'
import { dirInfo, ENCODER_DIRS, type EncoderDir } from './model'

export type EncoderPatch = Partial<Record<EncoderDir, KeyAction>>

export interface EncoderEditArgs {
    api: EncoderApi
    layerId: number
    slot: number
    /** The encoder's bindings before the edit. */
    before: EncoderAction
    patch: EncoderPatch
    /** Mirror bindings into the editor's keymap (optimistic UI + reverts). */
    apply: (enc: EncoderAction) => void
}

/** Directions the patch actually changes, in display order. */
function changedDirs(before: EncoderAction, patch: EncoderPatch): EncoderDir[] {
    return ENCODER_DIRS.map((d) => d.dir).filter(
        (dir) => patch[dir] !== undefined && patch[dir] !== before[dir],
    )
}

async function write(
    { api, layerId, slot }: EncoderEditArgs,
    enc: EncoderAction,
    dirs: EncoderDir[],
): Promise<void> {
    for (const dir of dirs) {
        await api.setEncoder(layerId, slot, dirInfo(dir).wire, enc[dir])
    }
}

/**
 * Build the command, or null when the patch changes nothing. The UI updates
 * before the device answers; if a write fails, the UI and the directions
 * already written go back to `before`, and the error is rethrown so no undo
 * entry is recorded.
 */
export function encoderEditCommand(args: EncoderEditArgs): DoCallback | null {
    const { before, patch, apply } = args
    const dirs = changedDirs(before, patch)
    if (dirs.length === 0) return null
    const after: EncoderAction = { ...before, ...patch }

    return async () => {
        apply(after)
        try {
            await write(args, after, dirs)
        } catch (e) {
            apply(before)
            await write(args, before, dirs).catch(() => undefined)
            throw e
        }
        return async () => {
            apply(before)
            try {
                await write(args, before, dirs)
            } catch (e) {
                console.error('Failed to undo encoder edit', e)
                // The device kept the newer bindings — show them.
                apply(after)
            }
        }
    }
}
