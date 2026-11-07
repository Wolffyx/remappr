// Pattern check: no GoF pattern (-) — rejected — pure helpers: the next
// release version and the draft notes, from tags and commit subjects.
//
// "Release to GitHub" (plan §6c A2, P10g): a tag v<semver> and a GitHub
// Release with notes; the repo's workflow then builds the firmware for the
// tag and attaches it to the Release.

const SEMVER = /^(\d+)\.(\d+)\.(\d+)$/

/** Commits Remappr makes that say nothing about the keymap. */
const PLUMBING = [
    'Start syncing with Remappr',
    'Attach the firmware to GitHub Releases',
]

export const isVersion = (v: string): boolean => SEMVER.test(v.trim())

export const tagOf = (version: string): string => `v${version.trim()}`

function parse(v: string): [number, number, number] | null {
    const m = SEMVER.exec(v.replace(/^v/, '').trim())
    return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null
}

const compare = (a: number[], b: number[]): number =>
    a[0] - b[0] || a[1] - b[1] || a[2] - b[2]

/** The newest v<semver> tag, as a version; null when there is none. */
export function latestVersion(tags: readonly string[]): string | null {
    const versions = tags
        .map(parse)
        .filter((v): v is [number, number, number] => v !== null)
        .sort(compare)
    const last = versions.at(-1)
    return last ? last.join('.') : null
}

/**
 * The version to offer: the document's own `meta.version` when it is newer
 * than every release, else the latest release with its patch bumped; 0.1.0
 * for a first release with no version of its own.
 */
export function nextVersion(
    docVersion: string | undefined,
    tags: readonly string[],
): string {
    const latest = latestVersion(tags)
    const own = docVersion ? parse(docVersion) : null
    if (!latest) return own ? own.join('.') : '0.1.0'
    const last = parse(latest)!
    if (own && compare(own, last) > 0) return own.join('.')
    return `${last[0]}.${last[1]}.${last[2] + 1}`
}

/** Draft notes: one line per change, oldest first, without Remappr's own
 *  plumbing commits or repeats. */
export function draftNotes(subjects: readonly string[]): string {
    const lines = [
        ...new Set(
            subjects
                .map((s) => s.trim())
                .filter((s) => s && !PLUMBING.includes(s)),
        ),
    ]
    return lines.map((s) => `- ${s}`).join('\n')
}
