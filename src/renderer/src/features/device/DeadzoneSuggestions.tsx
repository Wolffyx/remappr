// Pattern check: no GoF pattern (-) — rejected — leaf view: lists a calibration's deadzone suggestions and applies one through useBindingMutations (the editor's undoable binding edit).
//
// What a finished calibration measured, per stick: the inner deadzone that
// covers where it comes to rest, the outer that it reliably reaches. Apply
// stages it like any edit, so Save writes it and Undo / Discard take it back;
// nothing is changed until then.
import { JSX, useState } from 'react'
import { toast } from 'sonner'
import type { DeadzoneSuggestion } from '@firmware/service'

import { useBindingMutations } from '@/features/devices/model/bindingMutations'
import useDeviceEditorStore from '@/features/devices/model/deviceEditorStore'
import { Button } from '@/ui/button'

/** "inner 4 %, outer 97 %" for what was measured. */
function summarize(s: DeadzoneSuggestion): string {
    const parts = [
        s.inner === undefined ? null : `inner ${s.inner}%`,
        s.outer === undefined ? null : `outer ${s.outer}%`,
    ]
    return parts.filter(Boolean).join(', ')
}

/** Only the fields that were measured, as a binding patch. */
function patchOf(s: DeadzoneSuggestion): Record<string, number> {
    return {
        ...(s.inner === undefined ? {} : { inner: s.inner }),
        ...(s.outer === undefined ? {} : { outer: s.outer }),
    }
}

export function DeadzoneSuggestions({
    suggestions,
}: {
    suggestions: readonly DeadzoneSuggestion[]
}): JSX.Element | null {
    const { patch } = useBindingMutations()
    const controls = useDeviceEditorStore((s) => s.loaded?.model.controls)
    const [applied, setApplied] = useState<ReadonlySet<string>>(new Set())

    if (suggestions.length === 0) return null
    const nameOf = (id: string): string =>
        controls?.find((c) => c.id === id)?.name ?? id
    const apply = (s: DeadzoneSuggestion): void => {
        patch(s.controlId, patchOf(s))
        setApplied((prev) => new Set(prev).add(s.controlId))
        toast.success(`Deadzones set for ${nameOf(s.controlId)}`, {
            description: 'Save in the header to write them to the stick.',
        })
    }
    return (
        <div className="flex flex-col gap-2 rounded-md border border-border p-3">
            <p className="text-xs text-muted-foreground">
                Measured while you calibrated: where the stick comes to rest and
                how far it reaches.
            </p>
            {suggestions.map((s) => (
                <div
                    key={s.controlId}
                    className="flex items-center justify-between gap-3 text-xs"
                >
                    <span>
                        Suggested for {nameOf(s.controlId)}:{' '}
                        <span className="font-mono">{summarize(s)}</span>
                    </span>
                    <Button
                        size="sm"
                        variant="outline"
                        disabled={applied.has(s.controlId)}
                        onClick={() => apply(s)}
                    >
                        {applied.has(s.controlId) ? 'Applied' : 'Apply'}
                    </Button>
                </div>
            ))}
        </div>
    )
}
