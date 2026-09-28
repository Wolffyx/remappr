// pattern-check: skip — assertions over the start-page news model
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Release } from '@/lib/github'
import bundled from '../../../../../docs/public/news.json'
import {
    formatNewsDate,
    isUnread,
    mergeNews,
    mergeReleaseNotes,
    NEWS_LATEST_LIMIT,
    type NewsItem,
    parseNewsFile,
    parseReleaseNotes,
    releaseToNewsItem,
    summarizeReleaseNotes,
    whatsNewSince,
} from './newsModel'

const item = (over: Partial<NewsItem> & { id: string }): NewsItem => ({
    tag: 'announcement',
    pinned: false,
    date: '2026-09-01',
    title: over.id,
    body: '',
    ...over,
})

const release = (over: Partial<Release>): Release => ({
    tag_name: 'v0.0.16',
    name: 'v0.0.16',
    html_url: 'https://github.com/Wolffyx/remappr/releases/tag/v0.0.16',
    body: '',
    published_at: '2026-08-26T17:37:14Z',
    assets: [],
    ...over,
})

// Trimmed from the real v0.0.15 notes (release-please format).
const NOTES = `## [0.0.15](https://github.com/Wolffyx/remappr/compare/v0.0.14...v0.0.15) (2026-07-28)


### Features

* **profile:** generalized backup/restore (ZMK) + per-device auto-connect ([5352ef6](https://github.com/Wolffyx/remappr/commit/5352ef6))
* support dialog, Discord release workflow ([9addfd5](https://github.com/Wolffyx/remappr/commit/9addfd5))
* **support:** add "Support this project" dialog ([585712f](https://github.com/Wolffyx/remappr/commit/585712f))
* **support:** add "Support this project" dialog ([585712f](https://github.com/Wolffyx/remappr/commit/585712f))
* **lock:** unlock prompt ([#151](https://github.com/Wolffyx/remappr/issues/151)) ([3ab2c00](https://github.com/Wolffyx/remappr/commit/3ab2c00))


### Bug Fixes

* **auto-connect:** show toggle on first pair ([1111111](https://github.com/Wolffyx/remappr/commit/1111111))
`

afterEach(() => vi.restoreAllMocks())

describe('parseNewsFile', () => {
    it('accepts the bundled news.json', () => {
        const items = parseNewsFile(bundled)
        expect(items.length).toBe(bundled.items.length)
        expect(items.every((n) => typeof n.pinned === 'boolean')).toBe(true)
    })

    it('skips an invalid item and keeps the rest', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
        const items = parseNewsFile({
            items: [
                {
                    id: 'ok',
                    tag: 'fix',
                    date: '2026-09-01',
                    title: 'T',
                    body: '',
                },
                {
                    id: 'bad-tag',
                    tag: 'gossip',
                    date: '2026-09-01',
                    title: 'T',
                    body: '',
                },
                {
                    id: 'http',
                    tag: 'fix',
                    date: '2026-09-01',
                    title: 'T',
                    body: '',
                    url: 'http://x.dev',
                },
            ],
        })
        expect(items.map((n) => n.id)).toEqual(['ok'])
        expect(warn).toHaveBeenCalledTimes(2)
    })

    it('returns nothing for a payload without items', () => {
        vi.spyOn(console, 'warn').mockImplementation(() => {})
        expect(parseNewsFile({ news: [] })).toEqual([])
        expect(parseNewsFile(null)).toEqual([])
    })
})

describe('parseReleaseNotes', () => {
    it('keeps every entry with its scope, grouped by section', () => {
        expect(parseReleaseNotes(NOTES)).toEqual([
            {
                title: 'Features',
                entries: [
                    {
                        scope: 'profile',
                        text: 'Generalized backup/restore (ZMK) + per-device auto-connect',
                    },
                    { text: 'Support dialog, Discord release workflow' },
                    {
                        scope: 'support',
                        text: 'Add "Support this project" dialog',
                    },
                    { scope: 'lock', text: 'Unlock prompt (#151)' },
                ],
            },
            {
                title: 'Bug Fixes',
                entries: [
                    {
                        scope: 'auto-connect',
                        text: 'Show toggle on first pair',
                    },
                ],
            },
        ])
    })

    it('turns "closes" issue links into a plain reference', () => {
        const body =
            '### Bug Fixes\n\n* **actions:** make zero-slot behaviors assignable from the picker ([d8abe1a](https://github.com/Wolffyx/remappr/commit/d8abe1a2253eefcfe833997f897fa2e4c0)), closes [#149](https://github.com/Wolffyx/remappr/issues/149)\n'
        expect(parseReleaseNotes(body)[0].entries).toEqual([
            {
                scope: 'actions',
                text: 'Make zero-slot behaviors assignable from the picker (#149)',
            },
        ])
    })

    it('drops empty sections and notes without headings', () => {
        expect(parseReleaseNotes('### Features\n\n### Bug Fixes\n')).toEqual([])
        expect(parseReleaseNotes('* orphan bullet')).toEqual([])
    })
})

describe('summarizeReleaseNotes', () => {
    it('counts features, fixes and everything else', () => {
        const entry = { text: 'x' }
        expect(
            summarizeReleaseNotes([
                { title: 'Features', entries: [entry, entry] },
                { title: 'Bug Fixes', entries: [entry] },
                { title: 'Reverts', entries: [entry] },
                { title: 'Documentation', entries: [entry, entry] },
            ]),
        ).toBe('2 features · 1 fix · 3 other changes')
        expect(summarizeReleaseNotes([])).toBe('')
    })
})

describe('releaseToNewsItem', () => {
    it('titles a release by its version and keeps the full notes', () => {
        const n = releaseToNewsItem(
            release({ tag_name: 'v0.0.15', body: NOTES }),
        )
        expect(n).toMatchObject({
            id: 'release-v0.0.15',
            tag: 'release',
            version: 'v0.0.15',
            title: 'Version 0.0.15 released',
            body: '4 features · 1 fix',
            url: 'https://github.com/Wolffyx/remappr/releases/tag/v0.0.16',
        })
        expect(n?.notes?.map((s) => s.entries.length)).toEqual([4, 1])
    })

    it('tags a fixes-only release as a fix', () => {
        const body = NOTES.slice(NOTES.indexOf('### Bug Fixes'))
        const n = releaseToNewsItem(release({ body }))
        expect(n?.tag).toBe('fix')
        expect(n?.body).toBe('1 fix')
    })

    it('still lists a release whose notes have no entries', () => {
        const n = releaseToNewsItem(release({ body: 'Hotfix.' }))
        expect(n).toMatchObject({
            tag: 'release',
            title: 'Version 0.0.16 released',
            body: '',
            notes: [],
        })
    })

    it('leaves drafts and prereleases out', () => {
        expect(releaseToNewsItem(release({ prerelease: true }))).toBeNull()
        expect(releaseToNewsItem(release({ draft: true }))).toBeNull()
    })
})

describe('mergeNews', () => {
    const now = new Date(2026, 8, 28)

    it('splits pinned from latest and sorts both newest first', () => {
        const view = mergeNews(
            [
                item({ id: 'p-old', pinned: true, date: '2026-09-01' }),
                item({ id: 'p-new', pinned: true, date: '2026-09-20' }),
                item({ id: 'c', date: '2026-09-10' }),
            ],
            [item({ id: 'r', tag: 'release', date: '2026-09-15T10:00:00Z' })],
            now,
        )
        expect(view.pinned.map((n) => n.id)).toEqual(['p-new', 'p-old'])
        expect(view.latest.map((n) => n.id)).toEqual(['r', 'c'])
    })

    it('hides an item after its until day', () => {
        const curated = [
            item({ id: 'today', until: '2026-09-28' }),
            item({ id: 'gone', until: '2026-09-27', pinned: true }),
        ]
        const view = mergeNews(curated, [], now)
        expect(view.latest.map((n) => n.id)).toEqual(['today'])
        expect(view.pinned).toEqual([])
    })

    it('keeps the first of a duplicated id and caps the list', () => {
        const many = Array.from({ length: NEWS_LATEST_LIMIT + 3 }, (_, i) =>
            item({
                id: `r${i}`,
                date: `2026-09-${String(i + 1).padStart(2, '0')}`,
            }),
        )
        const view = mergeNews(
            [item({ id: 'r0', title: 'curated' })],
            many,
            now,
        )
        expect(view.latest).toHaveLength(NEWS_LATEST_LIMIT)
        expect(view.latest.filter((n) => n.id === 'r0')).toHaveLength(0)
        const all = mergeNews(
            [item({ id: 'x', title: 'curated' })],
            [item({ id: 'x', title: 'release' })],
            now,
        )
        expect(all.latest.map((n) => n.title)).toEqual(['curated'])
    })
})

describe('formatNewsDate', () => {
    const now = new Date(2026, 8, 28)

    it('shows month and day in the current year, and the year otherwise', () => {
        expect(formatNewsDate('2026-09-24', now)).toBe('Sep 24')
        expect(formatNewsDate('2025-12-31', now)).toBe('Dec 31, 2025')
    })
})

describe('isUnread', () => {
    const now = new Date(2026, 8, 28)

    it('is unread only when unseen and recent', () => {
        const fresh = item({ id: 'fresh', date: '2026-09-20' })
        const old = item({ id: 'old', date: '2026-07-01' })
        expect(isUnread(fresh, new Set(), now)).toBe(true)
        expect(isUnread(fresh, new Set(['fresh']), now)).toBe(false)
        expect(isUnread(old, new Set(), now)).toBe(false)
    })
})

describe('mergeReleaseNotes', () => {
    it('merges sections by heading and lists a shared entry once', () => {
        const merged = mergeReleaseNotes([
            [{ title: 'Features', entries: [{ text: 'B' }] }],
            [
                { title: 'Bug Fixes', entries: [{ text: 'X' }] },
                { title: 'Features', entries: [{ text: 'A' }, { text: 'B' }] },
            ],
        ])
        expect(merged).toEqual([
            { title: 'Features', entries: [{ text: 'B' }, { text: 'A' }] },
            { title: 'Bug Fixes', entries: [{ text: 'X' }] },
        ])
    })

    it('puts sections in release-please order', () => {
        const merged = mergeReleaseNotes([
            [{ title: 'Miscellaneous', entries: [{ text: 'M' }] }],
            [{ title: 'Bug Fixes', entries: [{ text: 'X' }] }],
            [{ title: 'Features', entries: [{ text: 'A' }] }],
        ])
        expect(merged.map((n) => n.title)).toEqual([
            'Features',
            'Bug Fixes',
            'Miscellaneous',
        ])
    })
})

describe('whatsNewSince', () => {
    const rel = (version: string, body: string): NewsItem =>
        releaseToNewsItem(
            release({ tag_name: `v${version}`, name: `v${version}`, body }),
        )!
    const feat = (text: string): string => `### Features\n\n* ${text}\n`
    const fix = (text: string): string => `### Bug Fixes\n\n* ${text}\n`
    const releases = [
        rel('0.0.20', fix('fix twenty')),
        rel('0.0.19', feat('feat nineteen')),
        rel('0.0.18', feat('feat eighteen')),
        rel('0.0.17', feat('feat seventeen')),
    ]

    it('collects every release after the last run up to the current one', () => {
        const result = whatsNewSince(releases, '0.0.17', '0.0.20')
        expect(result.kind).toBe('show')
        if (result.kind !== 'show') return
        expect(result.item.title).toBe('What’s new in Remappr 0.0.20')
        expect(result.item.body).toBe(
            'Everything since 0.0.17: 2 features · 1 fix',
        )
        expect(result.item.notes?.map((n) => n.title)).toEqual([
            'Features',
            'Bug Fixes',
        ])
        expect(result.item.url).toBe(releases[0].url)
    })

    it('stays quiet when only fixes landed', () => {
        expect(whatsNewSince(releases, '0.0.19', '0.0.20')).toEqual({
            kind: 'quiet',
        })
    })

    it('is pending until the running version has a release', () => {
        expect(whatsNewSince(releases, '0.0.20', '0.0.21')).toEqual({
            kind: 'pending',
        })
    })

    it('uses the single release summary when one version was skipped', () => {
        const result = whatsNewSince(releases, '0.0.18', '0.0.19')
        expect(result.kind === 'show' && result.item.body).toBe('1 feature')
    })
})
