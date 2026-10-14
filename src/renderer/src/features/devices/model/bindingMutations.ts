// Pattern check: Command (Tier 2) — extended — each binding edit is a Do/Undo pair pushed through stores/undoRedoStore.ts doIt, the same shape as features/keymap/keyboard/stage/useKeymapMutations.ts.
//
// Binding edits on the device editor: optimistic in the store, written to the
// device, reverted (and nothing pushed to undo) when the device refuses. The
// undo writes back to the profile the edit was made in, even if another
// profile is showing by then.
import { useCallback } from 'react'
import { toast } from 'sonner'
import type { ControlsApi } from '@firmware/service'
import type { ControlBinding } from '@firmware/devices/types'
import { bindingOf } from '@firmware/devices/defaults'
import undoRedoStore, { type DoCallback } from '@/stores/undoRedoStore'
import useDeviceEditorStore from './deviceEditorStore'

export interface BindingEdit {
    controls: ControlsApi
    profileId: string
    controlId: string
    prev: ControlBinding
    next: ControlBinding
}

type Put = (profileId: string, controlId: string, b: ControlBinding) => void

/** The undoable command for one binding edit. */
export function bindingCommand(edit: BindingEdit, put: Put): DoCallback {
    const { controls, profileId, controlId, prev, next } = edit
    const write = (b: ControlBinding): Promise<void> => {
        if (!controls.setBinding) throw new Error('This device is read-only')
        return controls.setBinding(profileId, controlId, b)
    }
    return async () => {
        put(profileId, controlId, next)
        try {
            await write(next)
        } catch (e) {
            put(profileId, controlId, prev)
            toast.error('Could not change the binding', {
                description: e instanceof Error ? e.message : String(e),
            })
            throw e
        }
        return async () => {
            put(profileId, controlId, prev)
            try {
                await write(prev)
            } catch (e) {
                console.error('Failed to undo binding edit', e)
                put(profileId, controlId, next)
            }
        }
    }
}

/** `patch` merged into `base`; a field set to `undefined` is removed. */
export function mergeBinding(
    base: ControlBinding,
    patch: Partial<Record<string, unknown>>,
): ControlBinding {
    const merged: Record<string, unknown> = { ...base, ...patch }
    for (const [k, v] of Object.entries(patch)) {
        if (v === undefined) delete merged[k]
    }
    return merged as unknown as ControlBinding
}

export interface BindingMutations {
    /** Change some fields of `controlId`'s binding in the active profile. */
    patch: (controlId: string, patch: Partial<Record<string, unknown>>) => void
    /** Replace `controlId`'s binding in the active profile. */
    replace: (controlId: string, next: ControlBinding) => void
}

export function useBindingMutations(): BindingMutations {
    const doIt = undoRedoStore((s) => s.doIt)

    const replace = useCallback(
        (controlId: string, next: ControlBinding): void => {
            const s = useDeviceEditorStore.getState()
            const { controls, activeProfileId, loaded } = s
            if (!controls?.setBinding || !activeProfileId || !loaded) return
            const control = loaded.model.controls.find(
                (c) => c.id === controlId,
            )
            if (!control) return
            const prev = bindingOf(
                control,
                s.bindings[activeProfileId] ?? {},
                loaded.index.catalog,
            )
            const edit = {
                controls,
                profileId: activeProfileId,
                controlId,
                prev,
                next,
            }
            void doIt(bindingCommand(edit, s.putBinding))
        },
        [doIt],
    )

    const patch = useCallback(
        (controlId: string, change: Partial<Record<string, unknown>>): void => {
            const s = useDeviceEditorStore.getState()
            const control = s.loaded?.model.controls.find(
                (c) => c.id === controlId,
            )
            if (!control || !s.loaded || !s.activeProfileId) return
            const current = bindingOf(
                control,
                s.bindings[s.activeProfileId] ?? {},
                s.loaded.index.catalog,
            )
            replace(controlId, mergeBinding(current, change))
        },
        [replace],
    )

    return { patch, replace }
}
