// Pattern check: no GoF pattern (-) — rejected — pure functions from an entry
// and its link to the files of a push, the manifest, and the hand-edit check.
//
// What a linked entry looks like in its repo (plan §6c A2):
//
//   <folder>/<slug>.remappr.json   the document, as saved (source of truth)
//   config/… keyboards/…           generated for the link's target
//   .github/workflows/…, README.md written once, then the user's
//   .remappr-sync.json             per item: version, source path, and the
//                                  git blob sha of every generated file
//
// The manifest keeps git blob shas (not sha256): a tree listing carries them,
// so finding a generated file edited on GitHub costs one request.
import { buildProjectBundle, parseKeymap } from '@firmware/config'
import type { BundleFile } from '@/lib/githubBuild'
import type { GitLink, LibraryEntry } from '@/lib/library/types'

export const MANIFEST_PATH = '.remappr-sync.json'

/** Files the bundle writes once; after that they are the user's. */
const WRITE_ONCE = [/^README\.md$/, /^\.github\//]

export interface ManifestItem {
    slug: string
    version: number
    source: string
    target: string | null
    generated: { path: string; blob: string }[]
    /** Generated files the user keeps as edited on GitHub: no device writes
     *  them again. In the repo, so every device knows (not only the one
     *  where the choice was made). */
    kept?: string[]
}

export interface Manifest {
    generator: string
    items: ManifestItem[]
}

export function slugOf(name: string): string {
    return (
        name
            .normalize('NFKD')
            .replace(/[̀-ͯ]/g, '')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .slice(0, 60) || 'remappr'
    )
}

export const sourcePath = (link: Pick<GitLink, 'folder' | 'slug'>): string =>
    `${link.folder}/${link.slug}.remappr.json`

/** The document as committed: as saved, ending in one newline. */
export const sourceText = (source: string): string =>
    source.endsWith('\n') ? source : `${source}\n`

/** Git's blob id of a text: sha1("blob <bytes>\0" + content). */
export async function gitBlobSha(text: string): Promise<string> {
    const body = new TextEncoder().encode(text)
    const head = new TextEncoder().encode(`blob ${body.length}\0`)
    const all = new Uint8Array(head.length + body.length)
    all.set(head)
    all.set(body, head.length)
    const digest = await crypto.subtle.digest('SHA-1', all)
    return [...new Uint8Array(digest)]
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('')
}

/** The target's files for a keymap entry; none for other kinds, no target,
 *  or files the user keeps as edited. Write-once files only when absent. */
export function generatedFiles(
    entry: Pick<LibraryEntry, 'kind' | 'source'>,
    link: Pick<GitLink, 'target' | 'keepTheirs'>,
    existing: ReadonlySet<string>,
): BundleFile[] {
    if (!link.target || entry.kind !== 'remappr.keymap') return []
    const keep = new Set(link.keepTheirs ?? [])
    const bundle = buildProjectBundle(parseKeymap(entry.source), link.target)
    return bundle.files
        .filter((f) => !keep.has(f.filename))
        .filter(
            (f) =>
                !WRITE_ONCE.some((re) => re.test(f.filename)) ||
                !existing.has(f.filename),
        )
        .map((f) => ({
            path: f.filename,
            content:
                typeof f.content === 'string'
                    ? f.content
                    : new TextDecoder().decode(f.content),
        }))
}

export function parseManifest(text: string | null): Manifest | null {
    if (!text) return null
    try {
        const m = JSON.parse(text) as Partial<Manifest>
        if (!Array.isArray(m.items)) return null
        return { generator: String(m.generator ?? ''), items: m.items }
    } catch {
        return null
    }
}

/** The manifest with this item's row replaced (other items untouched). */
export function withItem(
    prev: Manifest | null,
    item: ManifestItem,
    generator: string,
): Manifest {
    const others = (prev?.items ?? []).filter((i) => i.slug !== item.slug)
    return {
        generator,
        items: [...others, item].sort((a, b) => a.slug.localeCompare(b.slug)),
    }
}

export const manifestText = (m: Manifest): string =>
    `${JSON.stringify(m, null, 2)}\n`

/** Generated files of this item whose blob on the branch is not the one
 *  Remappr wrote: edited on GitHub. A deleted file counts too. */
export function handEditedFiles(
    manifest: Manifest | null,
    slug: string,
    tree: ReadonlyMap<string, string>,
    keepTheirs: readonly string[] = [],
): string[] {
    const item = manifest?.items.find((i) => i.slug === slug)
    if (!item) return []
    return item.generated
        .filter((g) => !keepTheirs.includes(g.path))
        .filter((g) => tree.get(g.path) !== g.blob)
        .map((g) => g.path)
}

/** Files kept as edited on GitHub: the repo's record plus this device's. */
export function keptFiles(
    manifest: Manifest | null,
    slug: string,
    local: readonly string[] = [],
): string[] {
    const item = manifest?.items.find((i) => i.slug === slug)
    return [...new Set([...(item?.kept ?? []), ...local])].sort()
}

/** The commit message: the version's message and the trailer. */
export function commitMessage(
    message: string,
    name: string,
    version: number,
): string {
    const subject = message.trim() || `Update ${name}`
    return `${subject}\n\nRemappr-Version: ${version}`
}

/** The message's subject line without the trailer. */
export const commitSubject = (message: string): string =>
    message.split('\n')[0]?.trim() ?? ''
