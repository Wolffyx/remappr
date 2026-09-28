// Pattern check: Dispatch Map (Tier 0) — applied — commit type → release-note heading lookup; the rest are pure functions over strings, no classes.
//
// Release notes for the sibling repos (#202). A release ships the app plus the
// firmware clients, UI kit and builder, which are linked in as source (see
// scripts/link-remappr.cjs); release-please only sees the app's commits. This
// adds the siblings' user-visible commits since the previous release to the
// app's release body, under the same headings release-please writes, with the
// repo as the scope ("firmware/vial: …"). Every consumer of the body — the
// GitHub release, Discord, the docs' What's new page and the app's release
// dialog — then lists them like app entries.
//
// The body also records the sibling commits the release was built from, as a
// hidden `<!-- remappr-lock {...} -->` line: the next release reads it as its
// starting point, and the release builds (build-release.yml, main.yml) check
// out exactly those commits.
//
// Pure functions only; finalize.ts does the GitHub calls.

export type SiblingName = 'firmware' | 'ui' | 'builder'

export interface Sibling {
    name: SiblingName
    /** owner/repo */
    repo: string
    /** Private repos list subjects only: their commit links would 404. */
    private: boolean
}

export const SIBLINGS: Sibling[] = [
    { name: 'firmware', repo: 'Wolffyx/remapprClientFirmware', private: false },
    { name: 'ui', repo: 'Wolffyx/remapprUI', private: false },
    { name: 'builder', repo: 'Wolffyx/remapprBuilder', private: true },
]

/** The sibling commit each project was built from. */
export type Lock = Partial<Record<SiblingName, string>>

const LOCK_LINE = /^<!-- remappr-lock (\{.*\}) -->$/m

export function readLock(body: string | null | undefined): Lock | null {
    const match = LOCK_LINE.exec(body ?? '')
    if (!match) return null
    try {
        return JSON.parse(match[1]) as Lock
    } catch {
        return null
    }
}

/** `body` with its lock line set to `lock` (replaced, or appended). */
export function writeLock(body: string, lock: Lock): string {
    const line = `<!-- remappr-lock ${JSON.stringify(lock)} -->`
    if (LOCK_LINE.test(body)) return body.replace(LOCK_LINE, line)
    return `${body.trimEnd()}\n\n${line}\n`
}

/** `body` without its lock line, for places that show the body raw. */
export function stripLock(body: string): string {
    return body.replace(LOCK_LINE, '').trimEnd()
}

export interface Commit {
    sha: string
    message: string
    url: string
}

type NoteType = 'feat' | 'fix' | 'perf'

// release-please's headings, in its order.
const HEADING: Record<NoteType, string> = {
    feat: 'Features',
    fix: 'Bug Fixes',
    perf: 'Performance Improvements',
}
const HEADING_ORDER = Object.values(HEADING)

export interface SiblingEntry {
    heading: string
    scope?: string
    subject: string
    sha: string
    url: string
}

const CONVENTIONAL = /^(feat|fix|perf)(?:\(([^)]+)\))?!?:\s*(.+)$/

/** A user-visible conventional commit, or null (chore, ci, docs, merges…). */
export function parseCommit(commit: Commit): SiblingEntry | null {
    const subject = commit.message.split('\n')[0].trim()
    const match = CONVENTIONAL.exec(subject)
    if (!match) return null
    const [, type, scope, text] = match
    return {
        heading: HEADING[type as NoteType],
        scope,
        subject: text.trim(),
        sha: commit.sha,
        url: commit.url,
    }
}

// Markdown links → their text, `(#12)`-style refs dropped, punctuation folded:
// the form two commits with the same subject share.
function normalize(text: string): string {
    return text
        .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
        .replace(/#\d+/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .trim()
}

const issueRefs = (text: string): string[] => text.match(/#\d+/g) ?? []

/** Subjects and issue refs of the app's own entries, to dedupe against. */
export function appEntryKeys(body: string): {
    subjects: Set<string>
    refs: Set<string>
} {
    const subjects = new Set<string>()
    const refs = new Set<string>()
    for (const line of body.split('\n')) {
        const bullet = /^\*\s+(?:\*\*[^*]+:\*\*\s*)?(.+)$/.exec(line)
        if (!bullet) continue
        // release-please appends `([abc1234](…))`; not part of the subject.
        const text = bullet[1].replace(
            /\s*\(\[[0-9a-f]{7,40}\]\([^)]*\)\)/g,
            '',
        )
        subjects.add(normalize(text))
        issueRefs(text).forEach((ref) => refs.add(ref))
    }
    return { subjects, refs }
}

/** The bullet release-please would write, with the repo leading the scope. */
export function formatEntry(entry: SiblingEntry, sibling: Sibling): string {
    const scope =
        entry.scope && entry.scope !== sibling.name
            ? `${sibling.name}/${entry.scope}`
            : sibling.name
    const link = sibling.private
        ? ''
        : ` ([${entry.sha.slice(0, 7)}](${entry.url}))`
    return `* **${scope}:** ${entry.subject}${link}`
}

/** The siblings' entries by heading, minus anything the app already lists
 *  (same subject, or the same issue ref) and repeats across siblings. */
export function siblingSections(
    appBody: string,
    commits: { sibling: Sibling; commits: Commit[] }[],
): Map<string, string[]> {
    const { subjects, refs } = appEntryKeys(appBody)
    const sections = new Map<string, string[]>()
    for (const { sibling, commits: list } of commits) {
        for (const commit of list) {
            const entry = parseCommit(commit)
            if (!entry) continue
            const key = normalize(entry.subject)
            if (subjects.has(key)) continue
            if (issueRefs(entry.subject).some((ref) => refs.has(ref))) continue
            subjects.add(key)
            const lines = sections.get(entry.heading) ?? []
            lines.push(formatEntry(entry, sibling))
            sections.set(entry.heading, lines)
        }
    }
    return sections
}

const headingRank = (title: string): number => {
    const i = HEADING_ORDER.indexOf(title)
    return i < 0 ? HEADING_ORDER.length : i
}

/** Append `entries` to the `### heading` section of `lines`, creating the
 *  section in release-please order if the body has none. */
function addToSection(
    lines: string[],
    heading: string,
    entries: string[],
): void {
    const at = lines.findIndex((l) => l.trim() === `### ${heading}`)
    if (at >= 0) {
        let end = lines.findIndex((l, i) => i > at && /^#{1,3}\s/.test(l))
        if (end < 0) end = lines.length
        while (end > at + 1 && lines[end - 1].trim() === '') end--
        lines.splice(end, 0, ...entries)
        return
    }
    let before = lines.findIndex(
        (l) =>
            /^###\s/.test(l) &&
            headingRank(l.slice(4).trim()) > headingRank(heading),
    )
    if (before < 0) {
        while (lines.length && lines[lines.length - 1].trim() === '')
            lines.pop()
        before = lines.length
        lines.push('')
    }
    lines.splice(before, 0, `### ${heading}`, '', ...entries, '')
}

/** The app's release body with the siblings' entries filed under its
 *  headings and the lock line set. */
export function buildReleaseBody(
    appBody: string,
    commits: { sibling: Sibling; commits: Commit[] }[],
    lock: Lock,
): string {
    const lines = stripLock(appBody).split('\n')
    const sections = siblingSections(appBody, commits)
    const ordered = [...sections].sort(
        ([a], [b]) => headingRank(a) - headingRank(b),
    )
    for (const [heading, entries] of ordered) {
        addToSection(lines, heading, entries)
    }
    return writeLock(lines.join('\n'), lock)
}
