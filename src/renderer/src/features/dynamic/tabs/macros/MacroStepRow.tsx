// Pattern check: no GoF pattern (-) — rejected — presentational row + chip composing existing HidUsageLabel/catStyle.
//
// One numbered macro step as plain words: drag handle, kind icon tile, the
// sentence with keycap chips, and the kind's short name. The whole row is a
// button that selects the step for the side panel.
import { GripVertical } from 'lucide-react'
import type { CSSProperties, DragEvent, ReactNode } from 'react'

import type { MacroAction } from '@firmware'
import { cn } from '@/lib/cn'
import { catStyle, categoryForUsage } from '@/lib/keymap/keyCategory'
import { HidUsageLabel } from '@/features/keymap/keyboard/HidUsageLabel'

import { rawToPacked } from '../../_shared/hidUsage'
import { STEP_META } from './macroSteps'

/** A key as a small keycap chip, tinted by its key category (modifiers violet). */
export function KeyChip({
    code,
    large = false,
}: {
    code: number
    large?: boolean
}): JSX.Element {
    if (!code) {
        return (
            <span className="text-control text-muted-foreground italic">
                no key yet
            </span>
        )
    }
    const packed = rawToPacked(code)
    const cat = catStyle(categoryForUsage(packed), 'subtle')
    const style: CSSProperties | undefined =
        cat.face === null
            ? undefined
            : { background: cat.face, color: cat.legend }
    return (
        <span
            style={style}
            className={cn(
                'inline-flex items-center justify-center rounded-md border border-input bg-background font-semibold',
                large
                    ? 'h-10 min-w-10 px-3.5 text-title'
                    : 'h-6 min-w-6 px-2 text-caption',
            )}
        >
            <HidUsageLabel hid_usage={packed} />
        </span>
    )
}

export function MonoChip({ children }: { children: ReactNode }): JSX.Element {
    return (
        <span className="inline-flex h-6 items-center rounded-md border border-input bg-muted px-2 font-mono text-caption">
            {children}
        </span>
    )
}

export function StepTile({ kind }: { kind: MacroAction['kind'] }): JSX.Element {
    const meta = STEP_META[kind]
    const mod = catStyle('mod', 'subtle')
    const Icon = meta.icon
    return (
        <span
            aria-hidden
            style={
                meta.tile === 'mod'
                    ? { background: mod.face ?? undefined, color: mod.legend }
                    : undefined
            }
            className={cn(
                'flex size-7 shrink-0 items-center justify-center rounded-lg',
                meta.tile !== 'mod' && meta.tile,
            )}
        >
            <Icon className="size-4" />
        </span>
    )
}

/** The row's words: verb, then a chip or a muted value. */
function StepWords({
    step,
    callSummary,
}: {
    step: MacroAction
    callSummary?: string
}): JSX.Element {
    const line = (verb: string, rest?: ReactNode): JSX.Element => (
        <span className="flex flex-wrap items-center gap-2 text-control">
            <span>{verb}</span>
            {rest}
        </span>
    )
    switch (step.kind) {
        case 'tap':
            return line('Tap', <KeyChip code={step.keycode} />)
        case 'down':
            return line('Hold', <KeyChip code={step.keycode} />)
        case 'up':
            return line('Let go of', <KeyChip code={step.keycode} />)
        case 'delay':
            return line(
                'Wait',
                <span className="text-muted-foreground">{step.ms} ms</span>,
            )
        case 'text':
            return line(
                'Type',
                <MonoChip>
                    {step.text ? `“${step.text}”` : 'no text yet'}
                </MonoChip>,
            )
        case 'pause':
            return line('Wait until you let go of the key')
        case 'call':
            return (
                <span className="flex flex-col gap-0.5">
                    {line(
                        'Run macro',
                        <MonoChip>{step.macro || 'no macro yet'}</MonoChip>,
                    )}
                    {callSummary && (
                        <span className="text-caption text-muted-foreground">
                            {callSummary}
                        </span>
                    )}
                </span>
            )
        case 'locked':
            return line(
                step.label,
                <span className="text-muted-foreground">{step.value}</span>,
            )
    }
}

export function MacroStepRow({
    step,
    n,
    selected,
    draggable,
    callSummary,
    onSelect,
    onDragStart,
    onDrop,
}: {
    step: MacroAction
    n: number
    selected: boolean
    draggable: boolean
    callSummary?: string
    onSelect: () => void
    onDragStart: () => void
    onDrop: () => void
}): JSX.Element {
    const locked = step.kind === 'locked'
    return (
        <li
            draggable={draggable}
            onDragStart={(e: DragEvent) => {
                e.dataTransfer.effectAllowed = 'move'
                onDragStart()
            }}
            onDragOver={(e: DragEvent) => draggable && e.preventDefault()}
            onDrop={(e: DragEvent) => {
                e.preventDefault()
                onDrop()
            }}
        >
            <button
                type="button"
                onClick={onSelect}
                aria-pressed={selected}
                className={cn(
                    'flex w-full items-center gap-2.5 rounded-lg border py-2 pr-3 pl-2 text-left transition-colors',
                    locked && 'border-dashed border-input bg-muted',
                    !locked &&
                        !selected &&
                        'border-border bg-card hover:bg-accent/50',
                    selected &&
                        'border-primary bg-primary/5 ring-3 ring-primary/20',
                )}
            >
                <GripVertical
                    aria-hidden
                    className={cn(
                        'size-3.5 shrink-0 text-muted-foreground',
                        draggable ? 'cursor-grab' : 'opacity-0',
                    )}
                />
                <span className="w-4 shrink-0 text-right text-caption text-muted-foreground">
                    {n}
                </span>
                <StepTile kind={step.kind} />
                <span className="min-w-0 flex-1">
                    <StepWords step={step} callSummary={callSummary} />
                </span>
                <span className="shrink-0 text-caption text-muted-foreground">
                    {STEP_META[step.kind].tag}
                </span>
            </button>
        </li>
    )
}
