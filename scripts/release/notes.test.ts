// pattern-check: skip — assertions over the release-notes helpers
import { describe, expect, it } from 'vitest'
import {
    buildReleaseBody,
    type Commit,
    parseCommit,
    readLock,
    SIBLINGS,
    siblingSections,
    stripLock,
    writeLock,
} from './notes.ts'

const [firmware, ui, builder] = SIBLINGS

const commit = (message: string, sha = 'a'.repeat(40)): Commit => ({
    sha,
    message,
    url: `https://github.com/x/y/commit/${sha}`,
})

// Shape of a real release-please body (v0.0.16, trimmed).
const APP_BODY = `## [0.1.0](https://github.com/Wolffyx/remappr/compare/v0.0.16...v0.1.0) (2026-10-01)


### Features

* **news:** show what's new after an update ([881b8e8](https://github.com/Wolffyx/remappr/commit/881b8e8))


### Bug Fixes

* **start-page:** device previews show the board, not its bindings ([f3910ec](https://github.com/Wolffyx/remappr/commit/f3910ec)), closes [#190](https://github.com/Wolffyx/remappr/issues/190)
`

describe('lock line', () => {
    it('round-trips, replaces an existing line and strips cleanly', () => {
        const once = writeLock(APP_BODY, { firmware: 'f1' })
        expect(readLock(once)).toEqual({ firmware: 'f1' })
        const twice = writeLock(once, { firmware: 'f2', ui: 'u2' })
        expect(twice.match(/remappr-lock/g)).toHaveLength(1)
        expect(readLock(twice)).toEqual({ firmware: 'f2', ui: 'u2' })
        expect(stripLock(twice)).toBe(APP_BODY.trimEnd())
    })

    it('reads nothing from a body without one', () => {
        expect(readLock(APP_BODY)).toBeNull()
        expect(readLock(null)).toBeNull()
    })
})

describe('parseCommit', () => {
    it('keeps feat, fix and perf with their scope', () => {
        expect(
            parseCommit(commit('feat(vial): xz decoder\n\nbody')),
        ).toMatchObject({
            heading: 'Features',
            scope: 'vial',
            subject: 'xz decoder',
        })
        expect(parseCommit(commit('fix!: breaking fix'))?.heading).toBe(
            'Bug Fixes',
        )
        expect(parseCommit(commit('perf: faster'))?.heading).toBe(
            'Performance Improvements',
        )
    })

    it('drops everything else', () => {
        for (const m of [
            'chore: bump',
            'ci: x',
            'docs: y',
            "Merge branch 'dev'",
        ]) {
            expect(parseCommit(commit(m))).toBeNull()
        }
    })
})

describe('siblingSections', () => {
    it('dedupes against the app by subject and by issue ref', () => {
        const sections = siblingSections(APP_BODY, [
            {
                sibling: firmware,
                commits: [
                    commit("feat(news): Show what's new after an update"),
                    commit('fix(vial): encoder swap (#190)'),
                    commit('fix(vial): raw hex labels'),
                ],
            },
        ])
        expect([...sections]).toEqual([
            [
                'Bug Fixes',
                [
                    `* **firmware/vial:** raw hex labels ([aaaaaaa](https://github.com/x/y/commit/${'a'.repeat(40)}))`,
                ],
            ],
        ])
    })

    it('lists a subject shared by two siblings once, builder without links', () => {
        const sections = siblingSections(APP_BODY, [
            { sibling: ui, commits: [commit('feat(ui): toggle group')] },
            {
                sibling: builder,
                commits: [
                    commit('feat: toggle group'),
                    commit('feat: kle import'),
                ],
            },
        ])
        expect(sections.get('Features')).toEqual([
            expect.stringMatching(/^\* \*\*ui:\*\* toggle group \(\[/),
            '* **builder:** kle import',
        ])
    })
})

describe('buildReleaseBody', () => {
    it('files entries under existing headings and adds missing ones in order', () => {
        const body = buildReleaseBody(
            APP_BODY,
            [
                {
                    sibling: builder,
                    commits: [
                        commit('perf: faster canvas'),
                        commit('feat: kle import'),
                        commit('fix: shield kconfig'),
                    ],
                },
            ],
            { builder: 'b'.repeat(40) },
        )
        const headings = body.split('\n').filter((l) => l.startsWith('### '))
        expect(headings).toEqual([
            '### Features',
            '### Bug Fixes',
            '### Performance Improvements',
        ])
        const features = body.slice(
            body.indexOf('### Features'),
            body.indexOf('### Bug Fixes'),
        )
        expect(features).toContain('* **news:** show')
        expect(features).toContain('* **builder:** kle import')
        const fixes = body.slice(
            body.indexOf('### Bug Fixes'),
            body.indexOf('### Performance'),
        )
        expect(fixes.trimEnd().split('\n').at(-1)).toBe(
            '* **builder:** shield kconfig',
        )
        expect(readLock(body)).toEqual({ builder: 'b'.repeat(40) })
    })

    it('only sets the lock when the siblings have nothing new', () => {
        const body = buildReleaseBody(APP_BODY, [], { ui: 'u' })
        expect(stripLock(body)).toBe(APP_BODY.trimEnd())
    })
})
