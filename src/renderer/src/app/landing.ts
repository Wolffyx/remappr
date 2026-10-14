// Pattern check: Dispatch Map (Tier 0) — applied — ordered rule table decides which screen the app shows; replaces the nested ternary in App.tsx so a new device class is one rule.
import type { KeyboardService } from '@firmware/service'
import type { LockState } from '@firmware/types'
import { isUnlocked } from '@firmware/types'

/** The screen the app shows. */
export type Landing =
    | 'builder'
    | 'start'
    | 'unlock'
    | 'devices'
    | 'dongle'
    | 'mouse'
    | 'keymap'

export interface LandingState {
    builderOpen: boolean
    service: KeyboardService | null
    lockState: LockState
}

type Rule = readonly [Landing, (s: LandingState) => boolean]

/** First match wins. */
const RULES: readonly Rule[] = [
    ['builder', (s) => s.builderOpen],
    ['start', (s) => !s.service],
    [
        'unlock',
        (s) =>
            s.service?.capabilities.lock === 'editor' &&
            !isUnlocked(s.lockState),
    ],
    // A device driven as controls opens the device editor, whatever its kind.
    ['devices', (s) => !!s.service?.controls],
    ['dongle', (s) => s.service?.kind === 'dongle'],
    ['mouse', (s) => s.service?.kind === 'mouse'],
]

export function resolveLanding(state: LandingState): Landing {
    const hit = RULES.find(([, matches]) => matches(state))
    return hit ? hit[0] : 'keymap'
}

/** Landings without a header of their own: the app adds the standalone title
 *  bar (drag region + window controls) above them. */
const BARE: ReadonlySet<Landing> = new Set(['unlock', 'dongle', 'mouse'])

export const needsTitleBar = (landing: Landing): boolean => BARE.has(landing)
