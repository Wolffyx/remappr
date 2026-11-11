// Pattern check: no GoF pattern (-) — rejected — pure helpers: the next
// release version and the draft notes, from tags and commit subjects.
//
// "Release to GitHub" (plan §6c A2, P10g): a tag <slug>-v<semver> and a
// GitHub Release with notes; the repo's workflow then builds the firmware for
// the tag and attaches it to the Release.
//
// Several items can share a repo (each on its own branch), so each item's
// tags carry its slug: every item has its own versions. Plain v<semver> tags
// are from before that; one belongs to the item whose branch holds its commit.

const SEMVER = /^(\d+)\.(\d+)\.(\d+)$/

/** Commits Remappr makes that say nothing about the keymap. */
const PLUMBING = [
    'Start syncing with Remappr',
    'Attach the firmware to GitHub Releases',
]

export const isVersion = (v: string): boolean => SEMVER.test(v.trim())

/** An item's release tag: `<slug>-v<semver>`. */
export const tagOf = (slug: string, version: string): string =>
    `${slug}-v${version.trim()}`

const PLAIN_TAG = /^v\d+\.\d+\.\d+$/

/** A tag from before per-item tags: `v<semver>`. */
export const isPlainTag = (tag: string): boolean => PLAIN_TAG.test(tag)

/** The version an item's tag names (its own `<slug>-v…` or a plain `v…`);
 *  null for any other tag. */
export function versionOfTag(tag: string, slug: string): string | null {
    const own = `${slug}-v`
    if (tag.startsWith(own)) {
        const rest = tag.slice(own.length)
        return SEMVER.test(rest) ? rest : null
    }
    return isPlainTag(tag) ? tag.slice(1) : null
}

/**
 * The releases that are this item's: its own tags, and plain tags made at a
 * commit of its branch (`onBranch`: the branch name or one of its commits).
 */
export function itemReleases<R extends { tag: string; target: string }>(
    releases: readonly R[],
    slug: string,
    onBranch: (target: string) => boolean,
): R[] {
    return releases.filter((r) =>
        isPlainTag(r.tag)
            ? onBranch(r.target)
            : versionOfTag(r.tag, slug) !== null,
    )
}

function parse(v: string): [number, number, number] | null {
    const m = SEMVER.exec(v.replace(/^v/, '').trim())
    return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null
}

const compare = (a: number[], b: number[]): number =>
    a[0] - b[0] || a[1] - b[1] || a[2] - b[2]

/** The newest of these versions (a leading v is allowed); null when none
 *  is one. */
export function latestVersion(versions: readonly string[]): string | null {
    const sorted = versions
        .map(parse)
        .filter((v): v is [number, number, number] => v !== null)
        .sort(compare)
    const last = sorted.at(-1)
    return last ? last.join('.') : null
}

/**
 * The version to offer: the document's own `meta.version` when it is newer
 * than every release, else the latest release with its patch bumped; 0.1.0
 * for a first release with no version of its own.
 */
export function nextVersion(
    docVersion: string | undefined,
    versions: readonly string[],
): string {
    const latest = latestVersion(versions)
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
