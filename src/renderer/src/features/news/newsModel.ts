// Pattern check: Dispatch Map (Tier 0) — applied — per-tag label/tone lookup table; the two sources map through plain functions, no class hierarchy needed.
//
// Start-page news: the data model and the pure logic behind it. Two sources
// feed it:
//   - docs/public/news.json, hand-written. Pinned items, announcements,
//     heads-ups and community posts live here. The app fetches it from the
//     main branch, so an edit ships without an app release; the copy bundled
//     at build time is the offline fallback. The docs site publishes the same
//     file at /news.json and renders it on its News page.
//   - GitHub Releases. Each release becomes a "Version X.Y.Z released" item
//     (tagged "fix" when its notes only list bug fixes) that carries every
//     entry of its notes; the start page opens them in a dialog.
//
// news.json format — { "items": [ ... ] }, each item:
//   id      string, unique                       required
//   tag     announcement | release | firmware | fix | notice | community
//   date    YYYY-MM-DD                           required
//   title   string                               required
//   body    string                               required
//   pinned  true to pin it (banner, pinned rows)  optional
//   until   YYYY-MM-DD; hidden after this day     optional
//   cta     link text, e.g. "Join the beta"       optional
//   url     https link the cta opens              optional
//   version e.g. "v0.0.17", shown in mono         optional
//   image   https cover image for the spotlight   optional
// An item that doesn't match is skipped; the rest still show.
import { z } from 'zod'
import type { Release } from '@/lib/github'
import { compareVersions } from '@shared/semver'

export const NEWS_TAG_IDS = [
    'announcement',
    'release',
    'firmware',
    'fix',
    'notice',
    'community',
] as const
export type NewsTagId = (typeof NEWS_TAG_IDS)[number]

/** One line of release-please notes: `* **scope:** text ([sha](…))`. */
export interface ReleaseNoteEntry {
    scope?: string
    text: string
}

/** A `### Heading` of release-please notes and its entries, in note order. */
export interface ReleaseNoteSection {
    title: string
    entries: ReleaseNoteEntry[]
}

export interface NewsItem {
    id: string
    tag: NewsTagId
    pinned: boolean
    /** ISO date (YYYY-MM-DD) or date-time. */
    date: string
    title: string
    body: string
    until?: string
    cta?: string
    url?: string
    version?: string
    image?: string
    /** Full release notes; set on items built from a GitHub release. */
    notes?: ReleaseNoteSection[]
}

export interface NewsView {
    /** Pinned hand-written items, newest first. */
    pinned: NewsItem[]
    /** Everything else, releases included, newest first. */
    latest: NewsItem[]
}

// Announcements and releases wear the theme's primary colour; the rest get a
// fixed hue. --news-tone-l (index.css) darkens them in light mode.
const tone = (hue: number): string => `oklch(var(--news-tone-l) 0.14 ${hue})`

export const NEWS_TAGS: Record<NewsTagId, { label: string; tone: string }> = {
    announcement: { label: 'Announcement', tone: 'var(--primary)' },
    release: { label: 'Release', tone: 'var(--primary)' },
    firmware: { label: 'Firmware', tone: tone(210) },
    fix: { label: 'Fix', tone: tone(152) },
    notice: { label: 'Heads-up', tone: tone(70) },
    community: { label: 'Community', tone: tone(340) },
}

/** How many non-pinned items the start page keeps. */
export const NEWS_LATEST_LIMIT = 8
/** Items older than this never count as unread, so a first run doesn't open
 *  with a pile of old releases marked new. */
export const NEWS_UNREAD_WINDOW_DAYS = 30

const DAY = /^\d{4}-\d{2}-\d{2}$/
const https = z.url({ protocol: /^https$/ })

const newsItemSchema = z.object({
    id: z.string().min(1),
    tag: z.enum(NEWS_TAG_IDS),
    date: z.string().regex(DAY),
    title: z.string().min(1),
    body: z.string(),
    pinned: z.boolean().optional(),
    until: z.string().regex(DAY).optional(),
    cta: z.string().min(1).optional(),
    url: https.optional(),
    version: z.string().min(1).optional(),
    image: https.optional(),
})

/** Parse a news.json payload. Items that don't match the format are skipped
 *  (and logged) so one typo doesn't blank the whole feed. */
export function parseNewsFile(raw: unknown): NewsItem[] {
    const file = z.object({ items: z.array(z.unknown()) }).safeParse(raw)
    if (!file.success) {
        console.warn('[news] news.json has no "items" array')
        return []
    }
    return file.data.items.flatMap((entry, i) => {
        const item = newsItemSchema.safeParse(entry)
        if (item.success) return [{ ...item.data, pinned: !!item.data.pinned }]
        console.warn(`[news] skipped news.json item #${i}:`, item.error.message)
        return []
    })
}

/** Every `### Heading` of release-please notes with its entries. Duplicate
 *  entries (release-please repeats a commit that landed twice) are dropped. */
export function parseReleaseNotes(body: string): ReleaseNoteSection[] {
    const sections: ReleaseNoteSection[] = []
    let current: ReleaseNoteSection | null = null
    let seen = new Set<string>()
    for (const line of body.split('\n')) {
        const heading = /^###\s+(.+?)\s*$/.exec(line)
        if (heading) {
            current = { title: heading[1], entries: [] }
            seen = new Set()
            sections.push(current)
            continue
        }
        const bullet = /^\*\s+(.+)$/.exec(line)
        if (!bullet || !current) continue
        const entry = parseEntry(bullet[1])
        const key = `${entry.scope ?? ''}|${entry.text}`
        if (seen.has(key)) continue
        seen.add(key)
        current.entries.push(entry)
    }
    return sections.filter((section) => section.entries.length)
}

// release-please decorations on an entry: `([abc1234](…))` commit links,
// `, closes [#12](…)` and `([#12](…))` issue links.
const COMMIT_LINK = /\s*\(\[[0-9a-f]{7,40}\]\([^)]*\)\)/g
const CLOSES_ISSUE = /,?\s*closes \[(#\d+)\]\([^)]*\)/gi
const MD_LINK = /\[([^\]]+)\]\([^)]*\)/g

/** `**scope:** thing ([abc1234](…)), closes [#12](…)` →
 *  `{ scope, text: 'Thing (#12)' }`. */
function parseEntry(raw: string): ReleaseNoteEntry {
    const scoped = /^\*\*([^*]+):\*\*\s*/.exec(raw)
    const plain = raw
        .slice(scoped ? scoped[0].length : 0)
        .replace(COMMIT_LINK, '')
        .replace(CLOSES_ISSUE, ' ($1)')
        .replace(MD_LINK, '$1')
        .replace(/\s+/g, ' ')
        .trim()
    const text = plain.charAt(0).toUpperCase() + plain.slice(1)
    return scoped ? { scope: scoped[1], text } : { text }
}

// Summary nouns for the headings release-please writes; any other heading
// counts as "other changes".
const SECTION_NOUN: Record<string, [one: string, many: string]> = {
    Features: ['feature', 'features'],
    'Bug Fixes': ['fix', 'fixes'],
    'Performance Improvements': [
        'performance improvement',
        'performance improvements',
    ],
}

const SECTION_ORDER = Object.keys(SECTION_NOUN)

/** "5 features · 3 fixes · 1 other change" */
export function summarizeReleaseNotes(sections: ReleaseNoteSection[]): string {
    const counts = new Map<string, number>()
    let other = 0
    for (const { title, entries } of sections) {
        if (SECTION_NOUN[title]) counts.set(title, entries.length)
        else other += entries.length
    }
    const parts = [...counts].map(([title, n]) => {
        const [one, many] = SECTION_NOUN[title]
        return `${n} ${n === 1 ? one : many}`
    })
    if (other)
        parts.push(`${other} other ${other === 1 ? 'change' : 'changes'}`)
    return parts.join(' · ')
}

/** One news item per published release, titled by its version and carrying
 *  its full notes. Drafts and prereleases are left out. */
export function releaseToNewsItem(release: Release): NewsItem | null {
    if (release.draft || release.prerelease) return null
    const notes = parseReleaseNotes(release.body ?? '')
    const has = (title: string): boolean => notes.some((n) => n.title === title)
    const fixesOnly = has('Bug Fixes') && !has('Features')
    const version = release.tag_name.replace(/^v/, '')
    return {
        id: `release-${release.tag_name}`,
        tag: fixesOnly ? 'fix' : 'release',
        pinned: false,
        date: release.published_at,
        title: `Version ${version} released`,
        body: summarizeReleaseNotes(notes),
        cta: 'What’s in it',
        url: release.html_url,
        version: release.tag_name,
        notes,
    }
}

/** Several releases' notes as one: sections merged by heading (in
 *  release-please order, unknown headings last), an entry listed once even
 *  when two releases carry it. */
export function mergeReleaseNotes(
    lists: ReleaseNoteSection[][],
): ReleaseNoteSection[] {
    const byTitle = new Map<string, ReleaseNoteSection>()
    const seen = new Set<string>()
    for (const { title, entries } of lists.flat()) {
        const section = byTitle.get(title) ?? { title, entries: [] }
        byTitle.set(title, section)
        for (const entry of entries) {
            const key = `${title}|${entry.scope ?? ''}|${entry.text}`
            if (seen.has(key)) continue
            seen.add(key)
            section.entries.push(entry)
        }
    }
    const rank = (title: string): number => {
        const i = SECTION_ORDER.indexOf(title)
        return i < 0 ? SECTION_ORDER.length : i
    }
    return [...byTitle.values()].sort((a, b) => rank(a.title) - rank(b.title))
}

// Sections worth a popup on launch. A release with only fixes still shows on
// the start page, but doesn't interrupt: with a release cut for every merge,
// a popup per patch would be noise.
const HIGHLIGHT_SECTIONS = new Set(['Features', 'Performance Improvements'])

/** What the post-update popup should do:
 *  - pending: the running version's release isn't in the list (yet)
 *  - quiet:   nothing since `since` is worth interrupting for
 *  - show:    one item with the notes of every release after `since` up to
 *             and including `current` */
export type WhatsNew =
    | { kind: 'pending' }
    | { kind: 'quiet' }
    | { kind: 'show'; item: NewsItem }

export function whatsNewSince(
    releases: NewsItem[],
    since: string,
    current: string,
): WhatsNew {
    const versionOf = (n: NewsItem): string => n.version ?? ''
    const latest = releases.find(
        (n) => compareVersions(versionOf(n), current) === 0,
    )
    if (!latest) return { kind: 'pending' }
    const range = releases.filter(
        (n) =>
            (compareVersions(versionOf(n), since) ?? 0) > 0 &&
            (compareVersions(versionOf(n), current) ?? 1) <= 0,
    )
    const notes = mergeReleaseNotes(range.map((n) => n.notes ?? []))
    if (!notes.some((n) => HIGHLIGHT_SECTIONS.has(n.title))) {
        return { kind: 'quiet' }
    }
    const summary = summarizeReleaseNotes(notes)
    return {
        kind: 'show',
        item: {
            ...latest,
            id: `whats-new-${current}`,
            // No version: the dialog then titles it by `title`, not
            // "Version X", and links to all releases.
            version: undefined,
            title: `What’s new in Remappr ${current}`,
            body:
                range.length > 1
                    ? `Everything since ${since.replace(/^v/, '')}: ${summary}`
                    : summary,
            notes,
        },
    }
}

/** A calendar day as a local Date, so `2026-09-28` doesn't slip a day west of
 *  UTC. Full date-times parse as usual. */
function toDate(iso: string): Date {
    if (!DAY.test(iso)) return new Date(iso)
    const [y, m, d] = iso.split('-').map(Number)
    return new Date(y, m - 1, d)
}

const newestFirst = (a: NewsItem, b: NewsItem): number =>
    toDate(b.date).getTime() - toDate(a.date).getTime()

function isExpired(item: NewsItem, now: Date): boolean {
    if (!item.until) return false
    const end = toDate(item.until)
    end.setDate(end.getDate() + 1)
    return now >= end
}

/** Combine both sources into what the start page shows. `limit` caps the
 *  non-pinned list (the docs News page passes Infinity). */
export function mergeNews(
    curated: NewsItem[],
    releases: NewsItem[],
    now: Date,
    limit = NEWS_LATEST_LIMIT,
): NewsView {
    const live = curated.filter((n) => !isExpired(n, now))
    const seen = new Set<string>()
    const firstOfId = (n: NewsItem): boolean => {
        if (seen.has(n.id)) return false
        seen.add(n.id)
        return true
    }
    const latest = [...live.filter((n) => !n.pinned), ...releases]
        .filter(firstOfId)
        .sort(newestFirst)
        .slice(0, limit)
    return { pinned: live.filter((n) => n.pinned).sort(newestFirst), latest }
}

/** "Sep 24", or "Sep 24, 2025" outside the current year. */
export function formatNewsDate(iso: string, now: Date): string {
    const date = toDate(iso)
    const sameYear = date.getFullYear() === now.getFullYear()
    return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        ...(sameYear ? {} : { year: 'numeric' }),
    })
}

export function isUnread(
    item: NewsItem,
    readIds: ReadonlySet<string>,
    now: Date,
): boolean {
    if (readIds.has(item.id)) return false
    const ageDays = (now.getTime() - toDate(item.date).getTime()) / 86_400_000
    return ageDays <= NEWS_UNREAD_WINDOW_DAYS
}
