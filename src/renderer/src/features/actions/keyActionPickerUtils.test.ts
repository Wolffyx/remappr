// pattern-check: skip — unit tests for a pure helper, no design pattern
// Covers issue #148: the &bt profile slot must appear only for the commands
// that take it (BT_SEL / BT_DISC) and stay hidden for the no-arg commands.
import { describe, expect, it } from 'vitest'
import type { ActionSlot, ActionType } from '@firmware/types'
import {
    behaviorRefFor,
    resolveSelection,
    sameParams,
    subsumedBehaviorIds,
    visibleSlots,
} from './keyActionPickerUtils'

const command: ActionSlot = {
    label: 'Command',
    kind: 'enum',
    values: [
        { value: 0, label: 'BT_CLR' },
        { value: 3, label: 'BT_SEL' },
        { value: 5, label: 'BT_DISC' },
    ],
}
const profile: ActionSlot = {
    label: 'profile',
    kind: 'number',
    range: { min: 0, max: 4 },
    enabledFor: [3, 5],
}

describe('visibleSlots', () => {
    it('hides a gated trailing slot when the command does not take it', () => {
        expect(visibleSlots([command, profile], [0])).toEqual([command])
        expect(visibleSlots([command, profile], [0, 2])).toEqual([command])
    })

    it('shows the gated slot for an enabling command (BT_SEL / BT_DISC)', () => {
        expect(visibleSlots([command, profile], [3, 0])).toEqual([
            command,
            profile,
        ])
        expect(visibleSlots([command, profile], [5, 1])).toEqual([
            command,
            profile,
        ])
    })

    it('hides the gated slot when no command is chosen yet', () => {
        expect(visibleSlots([command, profile], [])).toEqual([command])
    })

    it('keeps ungated slots (hold-taps) always visible', () => {
        const hold: ActionSlot = { label: 'Hold', kind: 'hid' }
        const tap: ActionSlot = { label: 'Tap', kind: 'hid' }
        expect(visibleSlots([hold, tap], [])).toEqual([hold, tap])
    })
})

// A composite "Mouse" type: one enum whose values dispatch (via behaviorRef) to
// the real &mkp (5) / &mmv (6) behaviors + a folded /mouse/i macro (8).
const mouseType: ActionType = {
    id: 'mouse',
    displayName: 'Mouse',
    slots: [
        {
            label: 'Command',
            kind: 'enum',
            values: [
                {
                    value: 0,
                    label: 'LMB',
                    behaviorRef: { kind: '5', params: [1] },
                },
                {
                    value: 1,
                    label: 'Move →',
                    behaviorRef: { kind: '6', params: [0x02580000] },
                },
                {
                    value: 2,
                    label: 'warp',
                    behaviorRef: { kind: '8', params: [] },
                },
            ],
        },
    ],
    // &mmv (2) / &msc (3) are subsumed without a command (unsettable on Studio).
    subsumes: ['2', '3'],
}
const normalType: ActionType = {
    id: '9',
    displayName: 'Key Press',
    slots: [{ label: 'Key', kind: 'hid' }],
}
const actionTypes = [mouseType, normalType]

describe('subsumedBehaviorIds', () => {
    it('unions behaviorRef kinds and the subsumes list', () => {
        expect(subsumedBehaviorIds(actionTypes)).toEqual(
            new Set(['5', '6', '8', '2', '3']),
        )
    })
    it('is empty when no type carries a behaviorRef', () => {
        expect(subsumedBehaviorIds([normalType]).size).toBe(0)
    })
})

describe('sameParams', () => {
    it('treats trailing zeros as equal', () => {
        expect(sameParams([1], [1, 0])).toBe(true)
        expect(sameParams([], [0])).toBe(true)
    })
    it('distinguishes different values', () => {
        expect(sameParams([1], [2])).toBe(false)
        expect(sameParams([1, 0], [1, 5])).toBe(false)
    })
})

describe('behaviorRefFor', () => {
    it('returns the picked value behaviorRef', () => {
        expect(behaviorRefFor(mouseType, [0])).toEqual({
            kind: '5',
            params: [1],
        })
        expect(behaviorRefFor(mouseType, [1])).toEqual({
            kind: '6',
            params: [0x02580000],
        })
    })
    it('returns undefined for a normal type or missing type', () => {
        expect(behaviorRefFor(normalType, [4])).toBeUndefined()
        expect(behaviorRefFor(undefined, [])).toBeUndefined()
    })
})

describe('resolveSelection', () => {
    it('reverse-maps an exact behaviorRef match to the composite + command', () => {
        expect(
            resolveSelection(actionTypes, {
                kind: '6',
                params: [0x02580000, 0],
            }),
        ).toEqual({ kind: 'mouse', params: [1] })
        expect(
            resolveSelection(actionTypes, { kind: '5', params: [1, 0] }),
        ).toEqual({ kind: 'mouse', params: [0] })
    })
    it('falls back to the composite first command for an unmatched param', () => {
        // custom-magnitude &mmv delta — still resolves to Mouse, not the raw type
        expect(
            resolveSelection(actionTypes, { kind: '6', params: [0x11110000] }),
        ).toEqual({ kind: 'mouse', params: [0] })
    })
    it('maps a subsumed behavior with no command to the composite first command', () => {
        // an unsettable &mmv (id 2) key loaded from a keymap → Mouse + first command
        expect(
            resolveSelection(actionTypes, { kind: '2', params: [64936] }),
        ).toEqual({ kind: 'mouse', params: [0] })
    })

    it('passes a normal behavior through unchanged', () => {
        expect(
            resolveSelection(actionTypes, { kind: '9', params: [4] }),
        ).toEqual({
            kind: '9',
            params: [4],
        })
    })
})
