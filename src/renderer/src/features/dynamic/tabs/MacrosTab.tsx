// pattern-check: skip — form tab composing primitives, mirrors sibling *Tab.tsx
import { DockActions } from '@/ui/dock-shell'
import { Circle, Plus } from 'lucide-react'
import { useState } from 'react'

import type { KeyboardService, MacroAction } from '@firmware'
import { saveWithToast } from '@/lib/saveWithToast'
import { Button } from '@/ui/button'

import { IndexInput } from '../_shared/IndexInput'
import { useDynamicEntry } from '../_shared/useDynamicEntry'
import { MacroActionRow } from './macros/MacroActionRow'
import { useKeyboardRecorder } from './macros/useKeyboardRecorder'

interface Props {
    service: KeyboardService
    opened: boolean
}

// pattern-check: skip — macro sequence editor body, extracted from MacroEditorModal
export function MacrosTab({ service, opened }: Props): JSX.Element | null {
    const count = service.macros?.getCount() ?? 0
    const [rawIdx, setIdx] = useState(0)
    const idx = Math.min(Math.max(0, rawIdx), Math.max(0, count - 1))

    // Editable only when the adapter is not view-only AND exposes a writer. ZMK
    // (compile-time macros) exposes `macros` with `readonly: true` and no
    // `setMacro` — the editor renders view-only. Never gate on a firmware name.
    const editable =
        !!service.macros &&
        !service.macros.readonly &&
        !!service.macros.setMacro

    const {
        entry: actions,
        setEntry: setActions,
        loading,
    } = useDynamicEntry<MacroAction[]>(
        service,
        idx,
        opened,
        (s, i) => s.macros?.getMacro(i),
        'macro',
    )

    const [recording, setRecording] = useState(false)
    useKeyboardRecorder(recording, editable, opened, setActions)

    const handleSetIdx = (n: number): void => {
        setRecording(false)
        setIdx(n)
    }

    if (count === 0) return null

    const update = (i: number, a: MacroAction): void => {
        if (!actions) return
        const next = actions.slice()
        next[i] = a
        setActions(next)
    }

    const remove = (i: number): void =>
        setActions((prev) => (prev ? prev.filter((_, k) => k !== i) : prev))

    const move = (i: number, delta: number): void => {
        if (!actions) return
        const j = i + delta
        if (j < 0 || j >= actions.length) return
        const next = actions.slice()
        const [item] = next.splice(i, 1)
        next.splice(j, 0, item)
        setActions(next)
    }

    const add = (): void =>
        setActions((prev) => [...(prev ?? []), { kind: 'tap', keycode: 0 }])

    const save = (): Promise<void> =>
        saveWithToast(
            async () => {
                if (!actions || !service.macros?.setMacro) return
                await service.macros.setMacro(idx, actions)
            },
            `Macro #${idx} saved`,
            'Failed to save macro',
        )

    return (
        <div className="space-y-3">
            {!editable && (
                <div className="rounded border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning">
                    This firmware doesn’t support editing macros from Remappr —
                    macros are defined at build time. Showing them read-only.
                </div>
            )}
            <IndexInput
                label="Macro"
                value={idx}
                count={count}
                onChange={handleSetIdx}
            />
            {loading && (
                <p className="text-xs text-muted-foreground">Loading…</p>
            )}
            {actions && (
                <div className="space-y-2">
                    {actions.map((a, i) => (
                        <MacroActionRow
                            key={i}
                            action={a}
                            onChange={(na) => update(i, na)}
                            onRemove={() => remove(i)}
                            onMoveUp={() => move(i, -1)}
                            onMoveDown={() => move(i, 1)}
                            readOnly={!editable}
                        />
                    ))}
                    {actions.length === 0 && (
                        <p className="text-xs text-muted-foreground italic">
                            {editable
                                ? 'Empty macro. Add actions below.'
                                : 'Empty macro.'}
                        </p>
                    )}
                </div>
            )}
            {editable && (
                <div className="flex items-center gap-2">
                    <Button onClick={add} size="sm" variant="outline">
                        <Plus className="h-3 w-3 mr-1" /> Add action
                    </Button>
                    <Button
                        onClick={() => setRecording((r) => !r)}
                        size="sm"
                        variant={recording ? 'destructive' : 'outline'}
                        disabled={!actions}
                    >
                        <Circle
                            className={`h-3 w-3 mr-1 ${recording ? 'fill-current animate-pulse' : ''}`}
                        />
                        {recording ? 'Stop' : 'Record'}
                    </Button>
                    {recording && (
                        <span className="text-xs text-muted-foreground">
                            Press keys to capture…
                        </span>
                    )}
                    <DockActions>
                        <Button onClick={save} size="sm" disabled={!actions}>
                            Save
                        </Button>
                    </DockActions>
                </div>
            )}
        </div>
    )
}
