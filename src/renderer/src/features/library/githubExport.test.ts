import { describe, expect, it } from 'vitest'
import type { GitLink, LibraryEntry } from '@/lib/library/types'
import { serializeKeymap, parseKeymap } from '@firmware/config'
import { defaultExportItem, exportCandidates, holdsBoard } from './githubExport'

const git = { repo: 'me/board' } as GitLink

const entry = (
    localId: string,
    over: Partial<LibraryEntry> = {},
): LibraryEntry =>
    ({
        localId,
        type: 'device',
        kind: 'remappr.keymap',
        name: 'Pad',
        source: '{}',
        updatedAt: 1,
        ...over,
    }) as LibraryEntry

describe('exportCandidates', () => {
    it('keeps keymaps of the type with the name, and every linked one', () => {
        const list = [
            entry('same'),
            entry('renamed', { name: 'Old pad', git }),
            entry('other', { name: 'Other' }),
            entry('config', { type: 'config' }),
            entry('layout', { kind: 'remappr.device-layout' }),
        ]
        expect(
            exportCandidates(list, 'device', 'Pad').map((e) => e.localId),
        ).toEqual(['renamed', 'same'])
    })

    it('lists linked items first, then the newest', () => {
        const list = [
            entry('old', { updatedAt: 1 }),
            entry('new', { updatedAt: 3 }),
            entry('linked', { updatedAt: 2, git }),
        ]
        expect(
            exportCandidates(list, 'device', 'Pad').map((e) => e.localId),
        ).toEqual(['linked', 'new', 'old'])
    })
})

describe('defaultExportItem', () => {
    it('offers the linked item of the board', () => {
        const list = [entry('snap'), entry('linked', { git })]
        expect(defaultExportItem(list, 'Pad')).toBe('linked')
    })

    it('never picks an unlinked snapshot, or another board', () => {
        const list = [entry('snap'), entry('renamed', { name: 'Old', git })]
        expect(defaultExportItem(list, 'Pad')).toBeNull()
    })
})

describe('holdsBoard', () => {
    const doc = {
        schemaVersion: 1,
        kind: 'remappr.keymap',
        meta: { name: 'Pad' },
        keyboard: { id: 'pad', name: 'Pad', keys: [{ x: 0, y: 0 }] },
        layers: [{ name: 'base', bindings: ['A'] }],
    }
    const board = serializeKeymap(parseKeymap(JSON.stringify(doc)))

    it('matches the same board however its JSON is spelled', () => {
        const spelled = JSON.stringify(doc, null, 4)
        expect(holdsBoard(entry('e', { source: spelled }), board)).toBe(true)
    })

    it('sees an edit, and a source it cannot read', () => {
        const edited = JSON.stringify({
            ...doc,
            layers: [{ name: 'base', bindings: ['B'] }],
        })
        expect(holdsBoard(entry('e', { source: edited }), board)).toBe(false)
        expect(holdsBoard(entry('e', { source: 'nope' }), board)).toBe(false)
    })
})
