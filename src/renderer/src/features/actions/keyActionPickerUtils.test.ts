// pattern-check: skip — unit tests for a pure helper, no design pattern
// Covers issue #148: the &bt profile slot must appear only for the commands
// that take it (BT_SEL / BT_DISC) and stay hidden for the no-arg commands.
import { describe, expect, it } from 'vitest'
import type { ActionSlot } from '@firmware/types'
import { visibleSlots } from './keyActionPickerUtils'

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
