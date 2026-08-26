// Pattern check: Observer (Tier 1) — extended — uses service.onPendingChangesChanged Observer instead of a pub-sub bridge.
//
// The history cluster: undo · redo · discard · the save pill. Owns the
// pending-changes subscription and the save-mode sync, so an undo push no
// longer re-renders every other control in the header.
import { useCallback, useEffect, useState } from 'react'
import { Redo2, Save, Trash2, Undo2 } from 'lucide-react'
import { toast } from 'sonner'

import { capabilityWarnings } from '@firmware/config'
import { applySaveMode, isSaveModeManaged } from '@/lib/saveMode'
import useConnectionStore from '@/stores/connectionStore'
import useConfigStore from '@/stores/configStore'
import useUserSettingsStore from '@/stores/userSettingsStore'
import undoRedoStore from '@/stores/undoRedoStore'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/ui/tooltip'
import { ToolbarButton } from './ToolbarButton'

export function HistoryTools(): JSX.Element {
    const service = useConnectionStore((s) => s.service)
    const setService = useConnectionStore((s) => s.setService)
    const communication = useConnectionStore((s) => s.communication)
    const undo = undoRedoStore((s) => s.undo)
    const redo = undoRedoStore((s) => s.redo)
    const reset = undoRedoStore((s) => s.reset)
    // Derived booleans (not the canUndo/canRedo getter fns) so the buttons
    // still re-render exactly when the stacks flip empty ⇄ non-empty.
    const canUndo = undoRedoStore((s) => s.undoStack.length > 0)
    const canRedo = undoRedoStore((s) => s.redoStack.length > 0)

    const [unsaved, setUnsaved] = useState<boolean>(false)
    // One Save button for every saveable firmware, driven by the Auto-save
    // setting via the save-mode controller (lib/saveMode.ts — attached to
    // every saveable service at connect; mock 'none' and read-only views stay
    // unmanaged and get no save UI). Manual mode → Save/Discard (QMK-family
    // stages client-side, ZMK stages on-device); auto mode → the same button
    // is a pulsing Auto-save indicator (QMK-family writes through, ZMK
    // auto-commits debounced). Derived from the SETTING, not the service
    // proxy, so the UI flips in the same render as the switch. Undo/redo stay
    // for all (client-side edit history).
    const autosave = useUserSettingsStore((s) => s.autosave)
    const saveManaged = !!service && isSaveModeManaged(service)
    const showSaveControls = saveManaged && !autosave
    const autoSaveActive = saveManaged && autosave

    useEffect(() => {
        if (!service) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setUnsaved(false)
            return
        }
        let cancelled = false
        ;(async () => {
            try {
                const pending = await service.refreshPendingChanges()
                if (!cancelled) setUnsaved(pending)
            } catch (e) {
                console.error('Failed to refresh pending changes', e)
            }
        })()
        const off = service.onPendingChangesChanged((pending) => {
            setUnsaved(pending)
        })
        return (): void => {
            cancelled = true
            off()
        }
    }, [service])

    const save = useCallback(async (): Promise<void> => {
        if (!service) return
        try {
            await service.commit()
            // The push succeeded, but a device silently ignores config fields
            // its firmware is too old to honor (§7.4.1 feature bitmask). Warn so
            // the user knows to update the firmware instead of chasing a
            // "setting had no effect" ghost. `limits` is present only once
            // GET_LIMITS answered, so firmwares without it never warn.
            const config = useConfigStore.getState().config
            const featureBitmask = service.limits?.featureBitmask
            if (config && featureBitmask !== undefined) {
                const warnings = capabilityWarnings(config, featureBitmask)
                if (warnings.length === 1) toast.warning(warnings[0].message)
                else if (warnings.length > 1)
                    toast.warning(
                        `Saved — but this firmware ignores ${warnings.length} settings you configured. Update the firmware to use them.`,
                    )
            }
        } catch (e) {
            console.error('Failed to save changes', e)
            // Adapters throw a descriptive reason (e.g. ZMK maps its
            // SaveChangesErrorCode); surface it so the user knows WHY.
            toast.error(
                e instanceof Error ? e.message : 'Failed to save changes',
            )
        }
    }, [service])

    const discard = useCallback(async (): Promise<void> => {
        if (!service) return
        try {
            await service.discardChanges()
        } catch (e) {
            console.error('Failed to discard changes', e)
            toast.error(`Failed to discard changes`)
        }

        reset()
        setService(service, communication ?? undefined)
    }, [service, communication, reset, setService])

    // Sync the live service's save-mode flag with the setting. No service
    // swap, no reconnect work — the controller flips in place. Turning auto ON
    // flushes staged edits first; on flush failure the setting reverts and the
    // edits stay staged.
    useEffect(() => {
        if (!service || !isSaveModeManaged(service)) return
        applySaveMode(service, autosave).catch((e: unknown) => {
            toast.error(
                e instanceof Error
                    ? e.message
                    : 'Failed to save staged changes',
            )
            useUserSettingsStore.getState().setAutosave(false)
        })
    }, [autosave, service])

    return (
        <>
            <ToolbarButton
                icon={Undo2}
                tooltip="Undo"
                label="Undo"
                disabled={!canUndo}
                onClick={undo}
            />
            <ToolbarButton
                icon={Redo2}
                tooltip="Redo"
                label="Redo"
                disabled={!canRedo}
                onClick={redo}
            />
            {showSaveControls && (
                <ToolbarButton
                    icon={Trash2}
                    tooltip="Discard changes"
                    label="Discard"
                    disabled={!unsaved}
                    onClick={discard}
                />
            )}
            {(showSaveControls || autoSaveActive) && (
                <Tooltip>
                    <TooltipTrigger asChild>
                        <button
                            type="button"
                            disabled={autoSaveActive || !unsaved || !service}
                            onClick={save}
                            data-dirty={unsaved && !autoSaveActive}
                            data-autosave={autoSaveActive}
                            className="ml-1 inline-flex h-8 items-center gap-1.5 rounded-lg border px-3 text-[13px] font-semibold transition-colors data-[dirty=false]:border-border data-[dirty=false]:bg-secondary data-[dirty=false]:text-muted-foreground data-[dirty=true]:border-transparent data-[dirty=true]:bg-primary data-[dirty=true]:text-primary-foreground data-[autosave=true]:animate-pulse data-[autosave=true]:border-primary/40 data-[autosave=true]:bg-primary/10 data-[autosave=true]:text-primary disabled:cursor-default disabled:opacity-100"
                        >
                            <Save className="size-3.5" />
                            {autoSaveActive
                                ? 'Auto-save'
                                : unsaved
                                  ? 'Save'
                                  : 'Saved'}
                            {unsaved && !autoSaveActive && (
                                <span className="size-1.5 rounded-full bg-current" />
                            )}
                        </button>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>
                            {autoSaveActive
                                ? 'Auto-save is on — every change is written to the keyboard immediately. Toggle it in Settings → Communication.'
                                : 'Save keymap to keyboard'}
                        </p>
                    </TooltipContent>
                </Tooltip>
            )}
        </>
    )
}
