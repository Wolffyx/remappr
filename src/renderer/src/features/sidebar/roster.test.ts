import { describe, expect, it } from 'vitest'
import { Keyboard } from 'lucide-react'
import {
    groupRoster,
    stripOrder,
    type RosterEntry,
    type RosterGroup,
} from './roster'

const USB: RosterGroup = { id: 'usb', label: 'USB', kind: 'direct' }
const DONGLE: RosterGroup = { id: 'dongle:x', label: 'Home', kind: 'dongle' }

const entry = (key: string, over: Partial<RosterEntry> = {}): RosterEntry => ({
    key,
    name: key,
    detail: '',
    icon: Keyboard,
    kind: 'keyboard',
    group: USB,
    online: true,
    active: false,
    open: async () => {},
    ...over,
})

describe('stripOrder', () => {
    it('puts the active device first, then pins, then recents, then the rest', () => {
        const list = [
            entry('a'),
            entry('b'),
            entry('c', { active: true }),
            entry('d'),
            entry('e'),
        ]
        const keys = stripOrder(list, ['e'], ['b', 'd']).map((e) => e.key)
        expect(keys).toEqual(['c', 'e', 'b', 'd', 'a'])
    })

    it('keeps roster order among devices never used', () => {
        const keys = stripOrder(
            [entry('x'), entry('y'), entry('z')],
            [],
            [],
        ).map((e) => e.key)
        expect(keys).toEqual(['x', 'y', 'z'])
    })
})

describe('groupRoster', () => {
    it('buckets entries by group in first-seen order', () => {
        const groups = groupRoster([
            entry('a'),
            entry('n1', { group: DONGLE }),
            entry('b'),
            entry('n2', { group: DONGLE }),
        ])
        expect(groups.map((g) => g.group.id)).toEqual(['usb', 'dongle:x'])
        expect(groups[1].entries.map((e) => e.key)).toEqual(['n1', 'n2'])
    })
})
