// Pattern check: no GoF pattern (-) — rejected — pull/push/resolve over
// injected deps (DI for tests); the link's `state` is plain data the UI reads,
// set by guard-claused steps, not a State-object hierarchy.
//
// Two-way sync of one library entry with a GitHub branch (plan §6c A2).
// - Pull: the branch head (ETag: a free 304 while nothing changed). When the
//   source file changed there, it becomes a 'github' version, unless the
//   entry also changed here: then a conflict for the user to settle.
// - Push: every saved version not on GitHub yet, oldest first, one commit
//   each (source + generated files + manifest, trailer Remappr-Version). That
//   list, read from local history, is the offline outbox: nothing is queued
//   twice and a version saved offline goes out on the next sync.
import type { BundleFile } from '@/lib/githubBuild'
import { RemoteMovedError } from '@/lib/githubBuild'
import {
    RELEASE_CONDITION,
    RELEASE_MARKER,
    upgradedWorkflow,
    WORKFLOW_PATHS,
} from '@firmware/config'
import type { GitLink, GitRelease, LibraryEntry } from '@/lib/library/types'
import type { LocalVersion } from '@/lib/library/versionRepo'
import {
    GithubApiError,
    isEmptyRepo,
    type BranchHead,
    type ReleaseInfo,
    type TagBuild,
    type RepoApi,
} from '../repoApi'
import {
    commitMessage,
    commitSubject,
    generatedFiles,
    gitBlobSha,
    handEditedFiles,
    keptFiles,
    MANIFEST_PATH,
    manifestText,
    parseManifest,
    sourcePath,
    sourceText,
    withItem,
    withRewrittenBlobs,
    type Manifest,
} from './layout'
import {
    draftNotes,
    HAND_EDIT_SUBJECT,
    isPlainTag,
    itemReleases,
    latestVersion,
    nextVersion,
    tagOf,
    versionOfTag,
} from './release'

export interface GitSyncDeps {
    /** The GitHub client; null when GitHub is not connected. */
    api(): Promise<RepoApi | null>
    entry(localId: string): LibraryEntry | undefined
    saveLink(localId: string, link: GitLink): Promise<void>
    versions(localId: string): Promise<LocalVersion[]>
    putVersion(v: LocalVersion): Promise<void>
    /** Make a pulled document the entry's (a 'github' version); its number. */
    applyGithub(
        localId: string,
        source: string,
        message: string,
        sha: string,
    ): Promise<number | null>
    /** Save a pulled document as a separate entry ("keep both"). */
    saveCopy(localId: string, source: string): Promise<void>
    /** Tell the cloud a commit was made or pulled (signed-in, synced entry). */
    markCloud(
        entry: LibraryEntry,
        version: number | null,
        sha: string,
    ): Promise<void>
    generator: string
    now(): number
}

export type PullResult =
    | 'unchanged'
    | 'advanced'
    | 'applied'
    | 'conflict'
    | 'removed'
    | 'failed'

export type ConflictChoice = 'mine' | 'theirs' | 'both'
export type HandEditChoice = 'overwrite' | 'keep'

/** Plain words for a failed GitHub call. */
export function syncErrorText(e: unknown): string {
    if (e instanceof RemoteMovedError)
        return 'The branch changed on GitHub meanwhile; sync again.'
    if (e instanceof GithubApiError) {
        if (e.status === 401)
            return 'GitHub refused the connection; connect GitHub again in Settings → Integrations.'
        if (e.status === 403 || e.status === 404)
            return 'GitHub denies access to this repo or branch. Check that the Remappr app is installed on it.'
        if (e.status === 409)
            return 'GitHub refused the change: the repo or branch is not ready for it.'
    }
    return e instanceof Error ? e.message : String(e)
}

/** The first schema problem of a parse failure (zod issues), else its
 *  message: what to fix in the file. */
export function firstProblem(err: unknown): string {
    const issues = (err as { issues?: unknown }).issues
    const first = Array.isArray(issues)
        ? (issues[0] as { message?: unknown; path?: unknown } | undefined)
        : undefined
    if (first && typeof first.message === 'string') {
        const path = Array.isArray(first.path)
            ? first.path
                  .map((p) =>
                      typeof p === 'number' ? `[${p}]` : `.${String(p)}`,
                  )
                  .join('')
                  .replace(/^\./, '')
            : ''
        return path ? `${path}: ${first.message}` : first.message
    }
    return err instanceof Error ? err.message : String(err)
}

/** A workflow with Remappr's release job that runs on per-item tags. */
const releasesTags = (text: string): boolean =>
    text.includes(RELEASE_MARKER) && text.includes(RELEASE_CONDITION)

const isOffline = (e: unknown): boolean =>
    (typeof navigator !== 'undefined' && navigator.onLine === false) ||
    (e instanceof TypeError && /fetch|network/i.test(e.message))

interface Remote {
    head: string
    tree: Map<string, string>
    manifest: Manifest | null
}

export interface GitSync {
    pull(localId: string): Promise<PullResult>
    /** Push the outbox; `head` also pushes unsaved edits, `overwrite` writes
     *  over generated files edited on GitHub. */
    push(
        localId: string,
        opts?: { head?: boolean; overwrite?: boolean },
    ): Promise<void>
    /** Settle a conflict: keep this device's document, take GitHub's, or keep
     *  both (GitHub's as a new entry); then push. */
    resolveConflict(localId: string, choice: ConflictChoice): Promise<void>
    /** Generated files edited on GitHub: write over them, or keep them
     *  (Remappr stops generating those files). */
    resolveHandEdits(localId: string, choice: HandEditChoice): Promise<void>
    /** What to offer for the next release: version, notes and the item's
     *  releases already made (other items of the repo have their own). */
    releaseDraft(localId: string, docVersion?: string): Promise<ReleaseDraft>
    /** Sync, then tag the synced commit and publish a GitHub Release. A
     *  workflow Remappr wrote before releases is upgraded first, so the
     *  firmware gets attached. */
    release(
        localId: string,
        version: string,
        notes: string,
    ): Promise<GitRelease>
}

export interface ReleaseDraft {
    version: string
    notes: string
    /** This item's releases, newest first. */
    releases: ReleaseInfo[]
    /** The Actions build of the latest release's tag. */
    build: TagBuild
}

export function createGitSync(deps: GitSyncDeps): GitSync {
    const linkOf = (localId: string): { e: LibraryEntry; link: GitLink } => {
        const e = deps.entry(localId)
        if (!e?.git) throw new Error('This entry is not linked to GitHub.')
        return { e, link: e.git }
    }

    const save = async (
        localId: string,
        changes: Partial<GitLink>,
    ): Promise<GitLink> => {
        const { link } = linkOf(localId)
        const next = { ...link, ...changes }
        await deps.saveLink(localId, next)
        return next
    }

    const requireApi = async (): Promise<RepoApi> => {
        const api = await deps.api()
        if (!api)
            throw new Error('Connect GitHub in Settings → Integrations first.')
        return api
    }

    const readRemote = async (
        api: RepoApi,
        link: GitLink,
        head: string,
    ): Promise<Remote> => {
        const tree = await api.tree(link.repo, head)
        const manifest = tree.has(MANIFEST_PATH)
            ? parseManifest(await api.readFile(link.repo, MANIFEST_PATH, head))
            : null
        return { head, tree, manifest }
    }

    /** Where the entry stands once the branch head is known. */
    const settle = async (
        localId: string,
        remote: Remote,
        changes: Partial<GitLink>,
    ): Promise<GitLink> => {
        const { e, link } = linkOf(localId)
        const merged = { ...link, ...changes }
        const handEdited = handEditedFiles(
            remote.manifest,
            merged.slug,
            remote.tree,
            keptFiles(remote.manifest, merged.slug, merged.keepTheirs),
        )
        const local = await gitBlobSha(sourceText(e.source))
        const state =
            handEdited.length > 0
                ? 'hand_edited'
                : local === merged.syncedBlob
                  ? 'synced'
                  : 'ahead'
        return save(localId, {
            ...changes,
            handEdited,
            state,
            error: undefined,
            conflictSha: undefined,
            lastSyncedAt: deps.now(),
        })
    }

    /** The source's blob at the last synced commit (a link that came from
     *  another device has the commit but not the blob). */
    const baseBlob = async (
        api: RepoApi,
        link: GitLink,
    ): Promise<string | undefined> => {
        if (link.syncedBlob || !link.lastSyncedSha) return link.syncedBlob
        return (await api.tree(link.repo, link.lastSyncedSha)).get(
            sourcePath(link),
        )
    }

    const applyCommit = async (
        api: RepoApi,
        localId: string,
        link: GitLink,
        remote: Remote,
    ): Promise<GitLink> => {
        const path = sourcePath(link)
        const text = await api.readFile(link.repo, path, remote.head)
        if (text === null) throw new Error(`${path} is not on GitHub.`)
        const info = await api.commitInfo(link.repo, remote.head)
        const by = info.author ? ` (GitHub, @${info.author})` : ' (GitHub)'
        const message = `${commitSubject(info.message) || 'Edited on GitHub'}${by}`
        let n: number | null
        try {
            n = await deps.applyGithub(localId, text, message, remote.head)
        } catch (err) {
            throw new Error(
                `${path} on GitHub is not a valid Remappr document: ${firstProblem(err)}`,
                { cause: err },
            )
        }
        const { e } = linkOf(localId)
        await deps.markCloud(e, null, remote.head).catch(() => undefined)
        return settle(localId, remote, {
            lastSyncedSha: remote.head,
            syncedBlob: remote.tree.get(path),
            syncedN: n ?? link.syncedN,
        })
    }

    /** The branch head. An empty repo first gets a commit of its own (an
     *  empty manifest), so the Git Data API has something to build on. */
    const branchHeadOrInit = async (
        api: RepoApi,
        link: GitLink,
    ): Promise<BranchHead> => {
        try {
            return await api.branchHead(
                link.repo,
                link.branch,
                link.lastSyncedSha ? link.etag : undefined,
            )
        } catch (e) {
            if (!isEmptyRepo(e)) throw e
            const sha = await api
                .initEmpty(
                    link.repo,
                    link.branch,
                    {
                        path: MANIFEST_PATH,
                        content: manifestText({
                            generator: deps.generator,
                            items: [],
                        }),
                    },
                    'Start syncing with Remappr',
                )
                // Someone made the first commit meanwhile: use theirs.
                .catch((err: unknown) => {
                    if (!(err instanceof GithubApiError) || err.status !== 422)
                        throw err
                    return null
                })
            if (!sha) return api.branchHead(link.repo, link.branch)
            return { changed: true, sha, etag: null }
        }
    }

    const pullWith = async (
        api: RepoApi,
        localId: string,
    ): Promise<PullResult> => {
        const { e, link } = linkOf(localId)
        const head = await branchHeadOrInit(api, link)
        if (!head.changed) return 'unchanged'
        const etag = head.etag ?? undefined
        const remote = await readRemote(api, link, head.sha)
        const path = sourcePath(link)
        const theirs = remote.tree.get(path)
        const mine = await gitBlobSha(sourceText(e.source))
        const base = await baseBlob(api, link)

        // Not on the branch (new link, or deleted there): the next push writes it.
        if (!theirs) {
            await save(localId, {
                etag,
                lastSyncedSha: head.sha,
                syncedBlob: undefined,
                state: 'ahead',
                error: undefined,
            })
            return link.lastSyncedSha && base ? 'removed' : 'advanced'
        }
        if (theirs === mine || theirs === base) {
            await settle(localId, remote, {
                etag,
                lastSyncedSha: head.sha,
                syncedBlob: theirs,
            })
            return 'advanced'
        }
        // The document changed on GitHub. Edited here too: the user decides.
        const dirty = base === undefined || mine !== base
        if (dirty) {
            await save(localId, {
                etag,
                state: 'conflict',
                conflictSha: head.sha,
                error: undefined,
            })
            return 'conflict'
        }
        await applyCommit(api, localId, { ...link, etag }, remote)
        await save(localId, { etag })
        return 'applied'
    }

    const fail = async (localId: string, e: unknown): Promise<void> => {
        if (!deps.entry(localId)?.git) return
        await save(
            localId,
            isOffline(e)
                ? { state: 'offline', error: undefined }
                : { state: 'error', error: syncErrorText(e) },
        )
    }

    /** Versions saved since the last push and not on GitHub, oldest first. */
    const outbox = async (
        localId: string,
        link: GitLink,
    ): Promise<LocalVersion[]> => {
        const after = Math.max(link.syncedN ?? 0, link.linkedAt)
        return (await deps.versions(localId)).filter(
            (v) => v.kind === 'checkpoint' && !v.gitSha && v.n > after,
        )
    }

    const filesFor = async (
        entry: LibraryEntry,
        link: GitLink,
        source: string,
        remote: Remote,
        version: number,
    ): Promise<{ files: BundleFile[]; manifest: Manifest }> => {
        const kept = keptFiles(remote.manifest, link.slug, link.keepTheirs)
        const generated = generatedFiles(
            { kind: entry.kind, source },
            { target: link.target, keepTheirs: kept },
            new Set(remote.tree.keys()),
        )
        const blobs = await Promise.all(
            generated.map((f) => gitBlobSha(f.content)),
        )
        const manifest = withItem(
            remote.manifest,
            {
                slug: link.slug,
                version,
                source: sourcePath(link),
                target: link.target,
                generated: generated.map((f, i) => ({
                    path: f.path,
                    blob: blobs[i],
                })),
                ...(kept.length > 0 ? { kept } : {}),
            },
            deps.generator,
        )
        return {
            files: [
                { path: sourcePath(link), content: sourceText(source) },
                ...generated,
                { path: MANIFEST_PATH, content: manifestText(manifest) },
            ],
            manifest,
        }
    }

    /** One commit of `source` on top of the branch head; the new remote. */
    const commitOne = async (
        api: RepoApi,
        localId: string,
        remote: Remote,
        source: string,
        subject: { message: string; version: number; n?: number },
    ): Promise<Remote> => {
        const { e, link } = linkOf(localId)
        const { files, manifest } = await filesFor(
            e,
            link,
            source,
            remote,
            subject.version,
        )
        const sha = await api.commit(
            link.repo,
            link.branch,
            remote.head,
            files,
            commitMessage(subject.message, e.name, subject.version),
        )
        const tree = new Map(remote.tree)
        for (const f of files) tree.set(f.path, await gitBlobSha(f.content))
        await save(localId, {
            lastSyncedSha: sha,
            syncedBlob: tree.get(sourcePath(link)),
            ...(subject.n !== undefined ? { syncedN: subject.n } : {}),
            etag: undefined,
            lastSyncedAt: deps.now(),
        })
        return { head: sha, tree, manifest }
    }

    const pushWith = async (
        api: RepoApi,
        localId: string,
        opts: { head?: boolean; overwrite?: boolean; subject?: string },
    ): Promise<void> => {
        await pullWith(api, localId)
        const { link } = linkOf(localId)
        // A conflict (found now or earlier) waits for the user.
        if (link.state === 'conflict') return
        if (link.state === 'hand_edited' && !opts.overwrite) return
        if (!link.lastSyncedSha) throw new Error('The branch head is unknown.')
        let remote = await readRemote(api, link, link.lastSyncedSha)
        await save(localId, { state: 'pushing', error: undefined })
        for (const v of await outbox(localId, link)) {
            const version = v.cloudVersion || v.n
            remote = await commitOne(api, localId, remote, v.source, {
                message: v.message,
                version,
                n: v.n,
            })
            await deps.putVersion({ ...v, gitSha: remote.head })
            const { e } = linkOf(localId)
            await deps
                .markCloud(e, v.cloudVersion || null, remote.head)
                .catch(() => undefined)
        }
        // "Sync now" with edits that are no saved version yet: push them as
        // is. Overwriting hand-edited files always makes a commit.
        const { e } = linkOf(localId)
        const mine = await gitBlobSha(sourceText(e.source))
        const ahead = mine !== linkOf(localId).link.syncedBlob
        if ((opts.head && ahead) || opts.overwrite) {
            const last = (await deps.versions(localId)).at(-1)
            remote = await commitOne(api, localId, remote, e.source, {
                // Only the generated files change: say how, not "Update …".
                message: ahead ? '' : (opts.subject ?? ''),
                version: last?.cloudVersion || last?.n || 0,
            })
            await deps.markCloud(e, null, remote.head).catch(() => undefined)
        }
        await settle(localId, remote, {})
    }

    /** The item's releases, newest first: its own tags, and plain tags
     *  (before per-item tags) made on its branch. */
    const releasesOf = async (
        api: RepoApi,
        link: GitLink,
    ): Promise<ReleaseInfo[]> => {
        const all = await api.listReleases(link.repo)
        // Only plain tags need the branch's commits to tell whose they are.
        const commits = all.some((r) => isPlainTag(r.tag))
            ? new Set(await api.commitShas(link.repo, link.branch))
            : new Set<string>()
        return itemReleases(
            all,
            link.slug,
            (target) => target === link.branch || commits.has(target),
        )
    }

    /** Make the workflows attach firmware to releases; how it stands. */
    const prepareWorkflows = async (
        api: RepoApi,
        localId: string,
        head: string,
    ): Promise<{ head: string; firmware: GitRelease['firmware'] }> => {
        const { link } = linkOf(localId)
        const tree = await api.tree(link.repo, head)
        const present = WORKFLOW_PATHS.filter((p) => tree.has(p))
        if (present.length === 0) return { head, firmware: 'none' }
        const upgrades: BundleFile[] = []
        let manual = false
        for (const path of present) {
            const text = (await api.readFile(link.repo, path, head)) ?? ''
            // An old Remappr workflow upgrades even when it already has the
            // release job (an earlier one could not build).
            const next = upgradedWorkflow(path, text)
            if (next) upgrades.push({ path, content: next })
            // Remappr's release job, but not one that runs on per-item tags
            // (edited by hand) attaches nothing either.
            else if (!releasesTags(text)) manual = true
        }
        if (upgrades.length === 0)
            return { head, firmware: manual ? 'manual' : 'attached' }
        const manifest = await rewrittenManifest(
            api,
            link,
            { head, tree },
            upgrades,
        )
        const sha = await api.commit(
            link.repo,
            link.branch,
            head,
            manifest ? [...upgrades, manifest] : upgrades,
            'Attach the firmware to GitHub Releases',
        )
        await save(localId, { lastSyncedSha: sha, etag: undefined })
        return { head: sha, firmware: manual ? 'manual' : 'attached' }
    }

    /** The manifest file with the upgraded workflows' new blobs; null when
     *  the branch has no manifest. */
    const rewrittenManifest = async (
        api: RepoApi,
        link: GitLink,
        { head, tree }: { head: string; tree: ReadonlyMap<string, string> },
        upgrades: readonly BundleFile[],
    ): Promise<BundleFile | null> => {
        if (!tree.has(MANIFEST_PATH)) return null
        const manifest = parseManifest(
            await api.readFile(link.repo, MANIFEST_PATH, head),
        )
        if (!manifest) return null
        const rewrites = await Promise.all(
            upgrades.map(async (u) => ({
                path: u.path,
                from: tree.get(u.path) ?? '',
                to: await gitBlobSha(u.content),
            })),
        )
        return {
            path: MANIFEST_PATH,
            content: manifestText(withRewrittenBlobs(manifest, rewrites)),
        }
    }

    const run = async (
        localId: string,
        task: (api: RepoApi) => Promise<void>,
    ): Promise<void> => {
        try {
            await task(await requireApi())
        } catch (e) {
            await fail(localId, e)
            throw e
        }
    }

    return {
        pull: async (localId: string): Promise<PullResult> => {
            let result: PullResult = 'failed'
            await run(localId, async (api) => {
                result = await pullWith(api, localId)
            })
            return result
        },
        /** Push the outbox; `head` also pushes unsaved edits, `overwrite`
         *  writes over generated files edited on GitHub. */
        push: (
            localId: string,
            opts: { head?: boolean; overwrite?: boolean } = {},
        ) => run(localId, (api) => pushWith(api, localId, opts)),
        /** Settle a conflict: keep this device's document, take GitHub's, or
         *  keep both (GitHub's as a new entry); then push. */
        resolveConflict: (localId: string, choice: ConflictChoice) =>
            run(localId, async (api) => {
                const { link } = linkOf(localId)
                if (!link.conflictSha) return
                const remote = await readRemote(api, link, link.conflictSha)
                if (choice === 'theirs') {
                    await applyCommit(api, localId, link, remote)
                    return
                }
                if (choice === 'both') {
                    const text = await api.readFile(
                        link.repo,
                        sourcePath(link),
                        remote.head,
                    )
                    if (text !== null) await deps.saveCopy(localId, text)
                }
                await save(localId, {
                    lastSyncedSha: remote.head,
                    syncedBlob: remote.tree.get(sourcePath(link)),
                    conflictSha: undefined,
                    state: 'ahead',
                })
                await pushWith(api, localId, { head: true })
            }),
        /** Generated files edited on GitHub: write over them, or keep them
         *  (Remappr stops generating those files). */
        resolveHandEdits: (localId: string, choice: HandEditChoice) =>
            run(localId, async (api) => {
                const { link } = linkOf(localId)
                const edited = link.handEdited ?? []
                if (choice === 'keep')
                    await save(localId, {
                        keepTheirs: [
                            ...new Set([...(link.keepTheirs ?? []), ...edited]),
                        ],
                        handEdited: [],
                        state: 'ahead',
                    })
                await pushWith(api, localId, {
                    head: true,
                    overwrite: true,
                    subject: HAND_EDIT_SUBJECT[choice],
                })
            }),
        releaseDraft: async (localId: string, docVersion?: string) => {
            const api = await requireApi()
            const { link } = linkOf(localId)
            const releases = await releasesOf(api, link)
            const versionOf = (r: ReleaseInfo): string =>
                versionOfTag(r.tag, link.slug) ?? ''
            const versions = releases.map(versionOf)
            const latest = latestVersion(versions)
            const latestTag =
                releases.find((r) => versionOf(r) === latest)?.tag ?? null
            // The synced commit, else the branch (both name a commit there).
            const head: string = link.lastSyncedSha ?? link.branch
            // A plain tag's commit can be gone from the branch (history
            // rewritten): GitHub has no compare, so the notes come from the
            // branch's own latest commits.
            const subjects = await api
                .commitSubjects(link.repo, latestTag, head)
                .catch((e: unknown) => {
                    if (!(e instanceof GithubApiError) || e.status !== 404)
                        throw e
                    return api.commitSubjects(link.repo, null, head)
                })
            const build: TagBuild = releases[0]
                ? await api
                      .tagBuild(link.repo, releases[0].tag)
                      // No Actions access: the release still shows.
                      .catch((): TagBuild => ({ state: 'none', url: null }))
                : { state: 'none', url: null }
            return {
                version: nextVersion(docVersion, versions),
                notes: draftNotes(subjects),
                releases,
                build,
            }
        },
        release: async (localId: string, version: string, notes: string) => {
            let made: GitRelease | null = null
            await run(localId, async (api) => {
                const { link: before } = linkOf(localId)
                const released = (await releasesOf(api, before)).find(
                    (r) => versionOfTag(r.tag, before.slug) === version.trim(),
                )
                if (released)
                    throw new Error(
                        `${released.tag} is already released on GitHub.`,
                    )
                await pushWith(api, localId, { head: true })
                const { e, link } = linkOf(localId)
                if (link.state === 'conflict')
                    throw new Error(
                        'This changed here and on GitHub: settle that first.',
                    )
                if (link.state === 'hand_edited')
                    throw new Error(
                        'Files Remappr makes were edited on GitHub: choose what happens to them first.',
                    )
                if (link.state !== 'synced' || !link.lastSyncedSha)
                    throw new Error(
                        'Sync first: the release is made from what is on GitHub.',
                    )
                const prepared = await prepareWorkflows(
                    api,
                    localId,
                    link.lastSyncedSha,
                )
                const tag = tagOf(link.slug, version)
                const info = await api.createRelease(link.repo, {
                    tag,
                    target: prepared.head,
                    name: `${e.name} v${version.trim()}`,
                    body: notes,
                })
                made = {
                    tag,
                    url: info.url,
                    at: deps.now(),
                    firmware: prepared.firmware,
                }
                await save(localId, { lastRelease: made })
            })
            if (!made) throw new Error('The release was not made.')
            return made
        },
    }
}
