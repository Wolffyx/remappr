// Pattern check: no GoF pattern (-) — rejected — dropdown menu + list are presentational compositions of existing ui primitives.
//
// "Add step": a grouped menu (Keys / Timing / Reuse) where every kind says what
// it does. A kind this keyboard can't do stays listed, disabled, with the reason.
import { Plus } from 'lucide-react'

import { Button } from '@/ui/button'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/ui/dropdown-menu'

import { ADD_GROUPS, STEP_META, type StepKind } from './macroSteps'

export function AddStepMenu({
    kinds,
    hasCallTarget,
    insertAfter,
    deviceNoun,
    onAdd,
}: {
    kinds: readonly StepKind[]
    hasCallTarget: boolean
    /** 1-based step the new one goes after; 0 = at the start. */
    insertAfter: number
    /** "keyboard" or "mouse", for the reason a kind is missing. */
    deviceNoun: string
    onAdd: (kind: StepKind) => void
}): JSX.Element {
    const whyNot = (kind: StepKind): string | null => {
        if (!kinds.includes(kind))
            return `Your ${deviceNoun}’s firmware can’t do this yet.`
        if (kind === 'call' && !hasCallTarget)
            return 'There’s no other macro this one can run.'
        return null
    }
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                    <Plus /> Add step
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" side="top" className="w-96">
                {ADD_GROUPS.map((g) => (
                    <div key={g.label}>
                        <DropdownMenuLabel className="eyebrow">
                            {g.label}
                        </DropdownMenuLabel>
                        {g.kinds.map((kind) => {
                            const reason = whyNot(kind)
                            return (
                                <DropdownMenuItem
                                    key={kind}
                                    disabled={reason !== null}
                                    onSelect={() => onAdd(kind)}
                                    className="flex-col items-start gap-0.5"
                                >
                                    <span className="font-semibold">
                                        {STEP_META[kind].title}
                                    </span>
                                    <span className="text-caption text-muted-foreground">
                                        {reason ?? STEP_META[kind].menu}
                                    </span>
                                </DropdownMenuItem>
                            )
                        })}
                    </div>
                ))}
                <DropdownMenuSeparator />
                <p className="px-2 py-1.5 text-caption text-muted-foreground">
                    {insertAfter === 0
                        ? 'New steps go at the start.'
                        : `New steps go after step ${insertAfter}.`}{' '}
                    Record keys adds steps as you type.
                </p>
            </DropdownMenuContent>
        </DropdownMenu>
    )
}
