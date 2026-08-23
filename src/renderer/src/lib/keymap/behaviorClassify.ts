// Pattern check: no GoF pattern (-) — rejected — a field read plus a predicate;
// the classification itself is polymorphic per adapter, not here.
//
// Which picker group a behavior belongs to. This used to re-derive the answer in
// the app by running ZMK's display-name → binding rules over EVERY firmware's
// action types — so a non-ZMK behavior was judged by ZMK's naming conventions.
//
// The adapter that produced the ActionType is the only thing that knows its own
// conventions, so it classifies (see ActionType.behaviorClass) and the app just
// reads the answer. An adapter that doesn't classify leaves the field unset,
// which means 'other': an ordinary system behavior.
import type { ActionType, BehaviorClass } from '@firmware/types'

export type { BehaviorClass }

export function classifyBehavior(at: ActionType): BehaviorClass {
    return at.behaviorClass ?? 'other'
}

export const isMacroOrCombo = (at: ActionType): boolean =>
    classifyBehavior(at) !== 'other'
