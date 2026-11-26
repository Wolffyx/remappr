// Pattern check: no GoF pattern (-) — rejected — one macro's editor (centre + side panel), composing the step row, panel and add menu.
//
// The centre and right of the Macros tab for one macro: name, "What it does",
// the numbered steps (click to select, drag to reorder), Add step / Record keys,
// the held-key check with Save and Discard, and the selected step's side panel.
// Keyed by macro index, so switching macros resets the selection.
import { CircleCheck, Circle, TriangleAlert } from 'lucide-react'
import { useRef, useState } from 'react'

import { describeMacro, heldAtEnd, type MacroAction } from '@firmware'
import { cn } from '@/lib/cn'
import { Button } from '@/ui/button'

import { AddStepMenu } from './AddStepMenu'
import {
    type CallChoices,
    MacroStepPanel,
    MacroViewOnlyPanel,
} from './MacroStepPanel'
import { MacroStepRow } from './MacroStepRow'
import { keyName, newStep, type StepKind } from './macroSteps'
import { useKeyboardRecorder } from './useKeyboardRecorder'

export interface MacroEditorProps {
    name: string
    description?: string
    used?: string
    steps: readonly MacroAction[]
    setSteps: (update: (prev: MacroAction[]) => MacroAction[]) => void
    /** False: the firmware can't write macros at all. */
    writable: boolean
    /** Why this macro is view only, or null. */
    blocked: string | null
    kinds: readonly StepKind[]
    choices: CallChoices
    dirty: boolean
    onSave: () => void
    onDiscard: () => void
}

function HeldCheck({ steps }: { steps: readonly MacroAction[] }): JSX.Element {
    const held = heldAtEnd(steps)
    if (held.length === 0) {
        return (
            <span className="flex items-center gap-1.5 text-xs text-success">
                <CircleCheck className="size-3.5" aria-hidden />
                Every held key is let go by the end
            </span>
        )
    }
    const names = held.map(keyName).join(', ')
    return (
        <span
            className="flex items-center gap-1.5 text-xs text-warning"
            role="status"
        >
            <TriangleAlert className="size-3.5" aria-hidden />
            {names} {held.length > 1 ? 'are' : 'is'} held and never let go
        </span>
    )
}

export function MacroEditor(props: MacroEditorProps): JSX.Element {
    const {
        name,
        description,
        used,
        steps,
        setSteps,
        writable,
        blocked,
        kinds,
        choices,
        dirty,
    } = props
    const editable = writable && !blocked
    const [sel, setSel] = useState<number | null>(steps.length ? 0 : null)
    const [recording, setRecording] = useState(false)
    const dragFrom = useRef<number | null>(null)

    useKeyboardRecorder(recording, editable, true, (update) =>
        setSteps(
            (prev) =>
                (typeof update === 'function' ? update(prev) : update) ?? prev,
        ),
    )

    const move = (from: number, to: number): void => {
        if (to < 0 || to >= steps.length || from === to) return
        setSteps((prev) => {
            const next = prev.slice()
            const [item] = next.splice(from, 1)
            next.splice(to, 0, item)
            return next
        })
        setSel(to)
    }
    const insertAt = sel === null ? steps.length : sel + 1
    const add = (kind: StepKind): void => {
        setSteps((prev) => [
            ...prev.slice(0, insertAt),
            newStep(kind, prev.slice(0, insertAt), choices.allowed),
            ...prev.slice(insertAt),
        ])
        setSel(insertAt)
    }
    const remove = (i: number): void => {
        setSteps((prev) => prev.filter((_, k) => k !== i))
        setSel(steps.length > 1 ? Math.min(i, steps.length - 2) : null)
    }

    return (
        <>
            <main className="flex min-h-0 min-w-0 flex-col">
                <div className="flex min-h-0 flex-1 flex-col gap-2.5 px-5 pt-3">
                    <div className="flex items-center gap-3">
                        <div className="flex min-w-0 flex-1 items-baseline gap-2">
                            <h2 className="font-mono text-base font-extrabold tracking-tight">
                                {name}
                            </h2>
                            {description && (
                                <span className="truncate text-sm text-muted-foreground">
                                    {description}
                                </span>
                            )}
                        </div>
                        {used && (
                            <span className="flex h-6.5 items-center rounded-full border border-border px-2.5 text-xs whitespace-nowrap text-muted-foreground">
                                {used}
                            </span>
                        )}
                    </div>
                    <p className="rounded-lg bg-muted px-3 py-2 text-sm leading-5">
                        <span className="font-semibold">What it does: </span>
                        {describeMacro(steps, keyName)}
                    </p>
                    <div className="-mx-1 flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-1 pb-3">
                        <ol
                            aria-label="Steps"
                            className="flex flex-col gap-1.5"
                        >
                            {steps.map((s, i) => (
                                <MacroStepRow
                                    key={i}
                                    step={s}
                                    n={i + 1}
                                    selected={editable && i === sel}
                                    draggable={editable}
                                    callSummary={
                                        s.kind === 'call'
                                            ? choices.summaries.get(s.macro)
                                            : undefined
                                    }
                                    onSelect={() => setSel(i)}
                                    onDragStart={() => (dragFrom.current = i)}
                                    onDrop={() =>
                                        dragFrom.current !== null &&
                                        move(dragFrom.current, i)
                                    }
                                />
                            ))}
                            {steps.length === 0 && (
                                <li className="text-sm text-muted-foreground italic">
                                    {editable
                                        ? 'No steps yet. Add one below.'
                                        : 'No steps.'}
                                </li>
                            )}
                        </ol>
                        {editable && (
                            <div className="flex items-center gap-2">
                                <AddStepMenu
                                    kinds={kinds}
                                    hasCallTarget={choices.allowed.length > 0}
                                    insertAfter={insertAt}
                                    onAdd={add}
                                />
                                <Button
                                    variant={
                                        recording ? 'destructive' : 'outline'
                                    }
                                    size="sm"
                                    onClick={() => setRecording((r) => !r)}
                                >
                                    <Circle
                                        className={cn(
                                            recording &&
                                                'animate-pulse fill-current',
                                        )}
                                    />
                                    {recording
                                        ? 'Stop recording'
                                        : 'Record keys'}
                                </Button>
                                <span className="text-xs text-muted-foreground">
                                    {recording
                                        ? 'Press keys to add them as Tap steps…'
                                        : insertAt === 0
                                          ? 'New steps go at the start.'
                                          : `New steps go after step ${insertAt}.`}
                                </span>
                            </div>
                        )}
                    </div>
                </div>
                <footer className="flex items-center gap-2 border-t border-border px-5 py-2.5">
                    <HeldCheck steps={steps} />
                    <div className="flex-1" />
                    {editable ? (
                        <>
                            {dirty && (
                                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                    <span
                                        aria-hidden
                                        className="size-2 rounded-full bg-warning"
                                    />
                                    Unsaved changes
                                </span>
                            )}
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={!dirty}
                                onClick={props.onDiscard}
                            >
                                Discard
                            </Button>
                            <Button
                                size="sm"
                                disabled={!dirty}
                                onClick={props.onSave}
                            >
                                Save to keyboard
                            </Button>
                        </>
                    ) : (
                        <span className="text-xs text-muted-foreground">
                            View only
                        </span>
                    )}
                </footer>
            </main>
            <aside
                aria-label="Step details"
                className="min-h-0 overflow-y-auto border-l border-border bg-background p-4"
            >
                {!writable && (
                    <MacroViewOnlyPanel
                        title="Macros are view only here"
                        reason="Your keyboard’s firmware sets its macros when it is built, so you can look at them here but not change them."
                    />
                )}
                {writable && blocked && (
                    <MacroViewOnlyPanel
                        title="This macro uses advanced steps"
                        reason={blocked}
                        hint="To change it, edit the macro in the config file."
                    />
                )}
                {editable && sel !== null && steps[sel] && (
                    <MacroStepPanel
                        steps={steps}
                        index={sel}
                        choices={choices}
                        onChange={(next) =>
                            setSteps((prev) =>
                                prev.map((s, k) => (k === sel ? next : s)),
                            )
                        }
                        onMove={(d) => move(sel, sel + d)}
                        onDuplicate={() => {
                            setSteps((prev) => [
                                ...prev.slice(0, sel + 1),
                                prev[sel],
                                ...prev.slice(sel + 1),
                            ])
                            setSel(sel + 1)
                        }}
                        onDelete={() => remove(sel)}
                    />
                )}
                {editable && (sel === null || !steps[sel]) && (
                    <p className="text-sm text-muted-foreground">
                        Pick a step to change it, or add one.
                    </p>
                )}
            </aside>
        </>
    )
}
