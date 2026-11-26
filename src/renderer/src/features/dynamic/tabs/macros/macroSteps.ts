// Pattern check: Dispatch Map (Tier 0) — applied — per-kind step metadata (label, icon, tile, menu text) as one Record keyed by kind.
//
// What the macro editor says about each step kind: the row verb, the side-panel
// title and explanation, the Add step menu entry and the icon tile. UI words only:
// "Hold" and "Let go" name the data model's down / up steps.
import {
    ArrowDownToLine,
    ArrowUpFromLine,
    CircleDot,
    CornerDownRight,
    Lock,
    Pause,
    Timer,
    Type,
    type LucideIcon,
} from 'lucide-react'

import { heldAtEnd, type MacroAction } from '@firmware'
import { hidUsageLongLabel, usageGlyph } from '@/lib/actions/hidUsages'

import { rawToPacked } from '../../_shared/rawKeycode'

export type StepKind = MacroAction['kind']

export interface StepMeta {
    /** Short name on the row's right ("Hold", "Wait for key release"). */
    tag: string
    /** Side-panel heading and Add step menu entry ("Hold a key"). */
    title: string
    /** One line under the menu entry. */
    menu: string
    icon: LucideIcon
    /** Tailwind classes for the icon tile; `mod` takes the modifier key colour. */
    tile: string | 'mod'
}

export const STEP_META: Record<StepKind, StepMeta> = {
    tap: {
        tag: 'Tap',
        title: 'Tap a key',
        menu: 'Press it and let go once',
        icon: CircleDot,
        tile: 'bg-primary/10 text-primary',
    },
    down: {
        tag: 'Hold',
        title: 'Hold a key',
        menu: 'Keep it down until a Let go step',
        icon: ArrowDownToLine,
        tile: 'mod',
    },
    up: {
        tag: 'Let go',
        title: 'Let go of a key',
        menu: 'Release a key you are holding',
        icon: ArrowUpFromLine,
        tile: 'mod',
    },
    text: {
        tag: 'Type text',
        title: 'Type text',
        menu: 'Type a word or a sentence',
        icon: Type,
        tile: 'bg-primary/10 text-primary',
    },
    delay: {
        tag: 'Wait',
        title: 'Wait',
        menu: 'Pause for a set number of milliseconds',
        icon: Timer,
        tile: 'bg-warning/15 text-warning',
    },
    pause: {
        tag: 'Wait for key release',
        title: 'Wait for key release',
        menu: 'Carry on when you let go of this macro’s key',
        icon: Pause,
        tile: 'bg-warning/15 text-warning',
    },
    call: {
        tag: 'Run macro',
        title: 'Run another macro',
        menu: 'Play another macro’s steps here',
        icon: CornerDownRight,
        tile: 'bg-success/15 text-success',
    },
    locked: {
        tag: 'Advanced · locked',
        title: 'Advanced step',
        menu: '',
        icon: Lock,
        tile: 'bg-muted text-muted-foreground',
    },
}

/** The Add step menu, grouped. `locked` is never added by hand. */
export const ADD_GROUPS: ReadonlyArray<{ label: string; kinds: StepKind[] }> = [
    { label: 'Keys', kinds: ['tap', 'down', 'up', 'text'] },
    { label: 'Timing', kinds: ['delay', 'pause'] },
    { label: 'Reuse', kinds: ['call'] },
]

/** What a firmware that doesn't list its macro step kinds supports. */
export const BASIC_MACRO_KINDS: readonly StepKind[] = [
    'tap',
    'down',
    'up',
    'delay',
    'text',
]

/** A key's full name for sentences ("Left Control"), from the raw keycode the
 *  macro holds. */
export function keyName(code: number): string {
    if (!code) return 'no key'
    const packed = rawToPacked(code)
    return (
        hidUsageLongLabel(packed) ?? (usageGlyph(packed, 12) || `key ${code}`)
    )
}

/** A fresh step of `kind`. A new Let go picks the key still held before it. */
export function newStep(
    kind: StepKind,
    before: readonly MacroAction[],
    callTargets: readonly string[],
): MacroAction {
    switch (kind) {
        case 'tap':
        case 'down':
            return { kind, keycode: 0 }
        case 'up':
            return { kind, keycode: heldAtEnd(before).at(-1) ?? 0 }
        case 'delay':
            return { kind, ms: 40 }
        case 'text':
            return { kind, text: '' }
        case 'pause':
            return { kind }
        case 'call':
            return { kind, macro: callTargets[0] ?? '' }
        case 'locked':
            throw new Error('A locked step is never added by hand')
    }
}
