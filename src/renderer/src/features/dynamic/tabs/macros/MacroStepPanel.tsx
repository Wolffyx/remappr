// Pattern check: no GoF pattern (-) — rejected — presentational side panel; per-kind field via the existing switch-on-kind shape.
//
// The side panel for the selected macro step: what it does in one sentence, the
// one field it has (key, milliseconds, text or the macro to run), and the step
// actions. A macro the editor can't change shows why instead.
import { ArrowDown, ArrowUp, Copy, Lock, Trash2 } from 'lucide-react'
import { useId, type ReactNode } from 'react'

import type { MacroAction } from '@firmware'
import { cn } from '@/lib/cn'
import { clampInt, parseIntSafe } from '@/lib/clampInt'
import { Button } from '@/ui/button'
import { Input } from '@/ui/input'
import { RadioGroup, RadioGroupItem } from '@/ui/radio-group'

import { KeycodeField } from '../../_shared/KeycodeField'
import { STEP_META } from './macroSteps'

export interface CallChoices {
    allowed: readonly string[]
    excluded: readonly { macro: string; reason: string }[]
    /** Each macro's one-line summary, by name. */
    summaries: ReadonlyMap<string, string>
}

/** One plain sentence on what this step does, pointing at related steps. */
function explain(steps: readonly MacroAction[], i: number): string {
    const step = steps[i]
    switch (step.kind) {
        case 'tap':
            return 'Presses the key and lets it go straight away.'
        case 'down': {
            const k = steps.findIndex(
                (s, j) =>
                    j > i && s.kind === 'up' && s.keycode === step.keycode,
            )
            return k < 0
                ? 'Keeps the key down until a Let go step. No later step lets it go yet.'
                : `Keeps the key down until a Let go step. Step ${k + 1} lets it go.`
        }
        case 'up':
            return 'Releases a key held by an earlier step.'
        case 'delay':
            return 'Pauses before the next step.'
        case 'text':
            return 'Types the text as if you typed it yourself.'
        case 'pause':
            return 'Stops here while you keep the macro’s key held, and carries on when you let go.'
        case 'call':
            return i + 1 < steps.length
                ? `Plays that macro’s steps here, then carries on with step ${i + 2}.`
                : 'Plays that macro’s steps here, then this macro ends.'
        case 'locked':
            return 'This editor can show this step but can’t change it yet.'
    }
}

function Note({
    title,
    children,
}: {
    title?: string
    children: ReactNode
}): JSX.Element {
    return (
        <div className="rounded-lg bg-muted px-3 py-2.5 text-xs leading-5 text-muted-foreground">
            {title && (
                <span className="mb-1 block font-semibold text-foreground">
                    {title}
                </span>
            )}
            {children}
        </div>
    )
}

function CallField({
    value,
    choices,
    onChange,
}: {
    value: string
    choices: CallChoices
    onChange: (macro: string) => void
}): JSX.Element {
    // Keep a target that is no longer offered visible instead of a blank pick.
    const names =
        choices.allowed.includes(value) || !value
            ? choices.allowed
            : [value, ...choices.allowed]
    return (
        <>
            <fieldset className="flex min-w-0 flex-col gap-1.5">
                <legend className="mb-1.5 text-sm font-semibold">
                    Macro to run
                </legend>
                {names.length === 0 && (
                    <p className="text-sm text-muted-foreground">
                        There’s no other macro this one can run.
                    </p>
                )}
                <RadioGroup
                    value={value}
                    onValueChange={onChange}
                    className="min-w-0 grid-cols-1 gap-1.5"
                >
                    {names.map((name) => (
                        <label
                            key={name}
                            htmlFor={`call-target-${name}`}
                            className={cn(
                                'flex min-w-0 cursor-pointer items-center gap-2.5 rounded-lg border px-2.5 py-2 text-sm',
                                name === value
                                    ? 'border-primary'
                                    : 'border-border',
                            )}
                        >
                            <RadioGroupItem
                                id={`call-target-${name}`}
                                value={name}
                            />
                            <span className="flex min-w-0 flex-col">
                                <span className="font-mono">{name}</span>
                                <span className="truncate text-xs text-muted-foreground">
                                    {choices.summaries.get(name)}
                                </span>
                            </span>
                        </label>
                    ))}
                </RadioGroup>
            </fieldset>
            {choices.excluded.length > 0 && (
                <Note title="Why some macros aren’t listed">
                    {choices.excluded.map(({ macro, reason }) => (
                        <span key={macro} className="block">
                            <span className="font-mono">{macro}</span> {reason}
                        </span>
                    ))}
                </Note>
            )}
        </>
    )
}

/** The editable field for the step, if it has one. */
function StepField({
    step,
    choices,
    onChange,
}: {
    step: MacroAction
    choices: CallChoices
    onChange: (next: MacroAction) => void
}): JSX.Element | null {
    const id = useId()
    switch (step.kind) {
        case 'tap':
        case 'down':
        case 'up':
            return (
                <div className="flex flex-col gap-1.5">
                    <span className="text-sm font-semibold">Key</span>
                    <KeycodeField
                        value={step.keycode}
                        onChange={(keycode) => onChange({ ...step, keycode })}
                    />
                </div>
            )
        case 'delay':
            return (
                <div className="flex flex-col gap-1.5 text-sm font-semibold">
                    <label htmlFor={id}>How long</label>
                    <span className="flex items-center gap-2 text-sm font-normal text-muted-foreground">
                        <Input
                            id={id}
                            type="number"
                            min={0}
                            max={0xffff}
                            value={step.ms}
                            onChange={(e) =>
                                onChange({
                                    kind: 'delay',
                                    ms: clampInt(
                                        parseIntSafe(e.target.value),
                                        0,
                                        0xffff,
                                    ),
                                })
                            }
                            className="w-24"
                        />
                        milliseconds
                    </span>
                </div>
            )
        case 'text':
            return (
                <div className="flex flex-col gap-1.5 text-sm font-semibold">
                    <label htmlFor={id}>Text</label>
                    <Input
                        id={id}
                        value={step.text}
                        onChange={(e) =>
                            onChange({ kind: 'text', text: e.target.value })
                        }
                        placeholder="What to type"
                    />
                </div>
            )
        case 'pause':
            return (
                <Note>
                    Everything before this step plays when you press the key.
                    Everything after it plays when you let go. Useful for
                    holding a modifier only while your finger is down.
                </Note>
            )
        case 'call':
            return (
                <CallField
                    value={step.macro}
                    choices={choices}
                    onChange={(macro) => onChange({ kind: 'call', macro })}
                />
            )
        case 'locked':
            return null
    }
}

/** Shown instead of the step editor when the macro can't be changed here. */
export function MacroViewOnlyPanel({
    title,
    reason,
    hint,
}: {
    title: string
    reason: string
    hint?: string
}): JSX.Element {
    return (
        <div className="flex flex-col gap-3">
            <span className="flex size-10 items-center justify-center rounded-lg bg-warning/15 text-warning">
                <Lock className="size-5" aria-hidden />
            </span>
            <h3 className="text-base font-bold">{title}</h3>
            <p className="text-sm leading-5 text-muted-foreground">{reason}</p>
            {hint && (
                <p className="text-sm leading-5 text-muted-foreground">
                    {hint}
                </p>
            )}
        </div>
    )
}

export function MacroStepPanel({
    steps,
    index,
    choices,
    onChange,
    onMove,
    onDuplicate,
    onDelete,
}: {
    steps: readonly MacroAction[]
    index: number
    choices: CallChoices
    onChange: (next: MacroAction) => void
    onMove: (delta: -1 | 1) => void
    onDuplicate: () => void
    onDelete: () => void
}): JSX.Element {
    const step = steps[index]
    return (
        <div className="flex h-full flex-col gap-3.5">
            <span className="text-xs font-bold tracking-wider text-muted-foreground uppercase">
                Step {index + 1}
            </span>
            <h3 className="-mt-2 text-base font-bold">
                {STEP_META[step.kind].title}
            </h3>
            <p className="text-sm leading-5 text-muted-foreground">
                {explain(steps, index)}
            </p>
            <StepField step={step} choices={choices} onChange={onChange} />
            <div className="flex-1" />
            <div className="grid grid-cols-2 gap-2">
                <Button
                    variant="outline"
                    size="sm"
                    disabled={index === 0}
                    onClick={() => onMove(-1)}
                >
                    <ArrowUp /> Move up
                </Button>
                <Button
                    variant="outline"
                    size="sm"
                    disabled={index === steps.length - 1}
                    onClick={() => onMove(1)}
                >
                    <ArrowDown /> Move down
                </Button>
                <Button variant="outline" size="sm" onClick={onDuplicate}>
                    <Copy /> Duplicate step
                </Button>
                <Button variant="outline" size="sm" onClick={onDelete}>
                    <Trash2 /> Delete step
                </Button>
            </div>
        </div>
    )
}
