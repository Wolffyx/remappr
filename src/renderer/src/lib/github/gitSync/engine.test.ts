import { describe, expect, it } from 'vitest'
import { RemoteMovedError } from '@/lib/githubBuild'
import type { GitLink, LibraryEntry } from '@/lib/library/types'
import type { LocalVersion } from '@/lib/library/versionRepo'
import { GithubApiError, type RepoApi } from '../repoApi'
import { createGitSync, firstProblem } from './engine'
import { gitBlobSha, MANIFEST_PATH, sourceText } from './layout'

interface FakeCommit {
    files: Map<string, string>
    message: string
    author: string
    parent?: string
}

interface FakeRelease {
    tag: string
    name: string
    url: string
    createdAt: string
    target: string
    body: string
}

interface FakeGithub {
    api: RepoApi
    calls: { headReads: number; notModified: number; commits: number }
    head(): string
    file(path: string): string | undefined
    message(): string
    edit(path: string, content: string, message?: string): void
    releases: FakeRelease[]
    /** No commits at all, like a repo created without a README. */
    wipe(): void
}

/** An in-memory branch: commits by sha, a head, an ETag per head. */
function fakeGithub(
    initial: Record<string, string> = { 'README.md': 'hi\n' },
): FakeGithub {
    const commits = new Map<string, FakeCommit>()
    let n = 0
    const nextSha = (): string => (++n).toString(16).padStart(40, '0')
    let head = nextSha()
    commits.set(head, {
        files: new Map(Object.entries(initial)),
        message: 'init',
        author: 'octo',
    })
    const calls = { headReads: 0, notModified: 0, commits: 0 }
    const releases: FakeRelease[] = []

    const api: RepoApi = {
        listRepos: async () => [],
        getRepo: async () => ({
            fullName: 'o/r',
            defaultBranch: 'main',
            private: true,
            canPush: true,
        }),
        async branchHead(_full, _branch, etag) {
            calls.headReads++
            if (!head) throw new GithubApiError(409, 'Git Repository is empty.')
            if (etag === `"${head}"`) {
                calls.notModified++
                return { changed: false }
            }
            return { changed: true, sha: head, etag: `"${head}"` }
        },
        async tree(_full, sha) {
            const files = commits.get(sha)!.files
            const out = new Map<string, string>()
            for (const [p, c] of files) out.set(p, await gitBlobSha(c))
            return out
        },
        readFile: async (_full, path, ref) =>
            commits.get(ref)!.files.get(path) ?? null,
        commitInfo: async (_full, sha) => ({
            message: commits.get(sha)!.message,
            author: commits.get(sha)!.author,
            date: '',
        }),
        listReleases: async () => releases.map((r) => ({ ...r, assets: [] })),
        async createRelease(_full, r) {
            if (releases.some((x) => x.tag === r.tag))
                throw new GithubApiError(
                    422,
                    `${r.tag} is already released on GitHub.`,
                )
            const made = {
                tag: r.tag,
                name: r.name,
                url: `https://github.com/o/r/releases/tag/${r.tag}`,
                createdAt: '',
                target: r.target,
                body: r.body,
            }
            releases.unshift(made)
            return { ...made, assets: [] }
        },
        async commitSubjects(_full, base, headSha) {
            // Walk back from the head until the base tag's commit.
            const stop = base
                ? releases.find((r) => r.tag === base)?.target
                : undefined
            const out: string[] = []
            let sha: string | undefined = headSha
            while (sha && sha !== stop) {
                const c = commits.get(sha)
                if (!c) break
                out.push(c.message.split('\n')[0])
                sha = c.parent
            }
            return out.reverse()
        },
        async initEmpty(_full, _branch, file, message) {
            if (head) throw new GithubApiError(422, 'not empty')
            head = nextSha()
            commits.set(head, {
                files: new Map([[file.path, file.content]]),
                message,
                author: 'remappr',
            })
            return head
        },
        async commit(_full, _branch, parent, files, message) {
            if (parent !== head) throw new RemoteMovedError(head)
            calls.commits++
            const next = new Map(commits.get(head)!.files)
            for (const f of files) next.set(f.path, f.content)
            head = nextSha()
            commits.set(head, {
                files: next,
                message,
                author: 'remappr',
                parent,
            })
            return head
        },
    }
    return {
        api,
        calls,
        head: () => head,
        file: (path: string) => commits.get(head)!.files.get(path),
        message: () => commits.get(head)!.message,
        releases,
        wipe() {
            head = ''
        },
        /** Someone commits on GitHub. */
        edit(path: string, content: string, message = 'edit on github') {
            const next = new Map(commits.get(head)!.files)
            next.set(path, content)
            const parent = head
            head = nextSha()
            commits.set(head, { files: next, message, author: 'octo', parent })
        },
    }
}

const doc = (layers: number): string =>
    JSON.stringify({ kind: 'remappr.keymap', layers })

interface Harness {
    gh: FakeGithub
    sync: ReturnType<typeof createGitSync>
    link(changes?: Partial<GitLink>): Promise<void>
    versions: LocalVersion[]
    copies: string[]
    cloudMarks: [number | null, string][]
    get(): LibraryEntry
    edit(source: string): void
    checkpoint(message: string): LocalVersion
}

function harness(gh: FakeGithub = fakeGithub()): Harness {
    const entry: LibraryEntry = {
        localId: 'e1',
        type: 'config',
        kind: 'remappr.keymap',
        name: 'Corne',
        source: doc(1),
        summary: {},
        createdAt: 0,
        updatedAt: 0,
        sync: { dirty: false, state: 'local' },
    }
    const entries = new Map([[entry.localId, entry]])
    const versions: LocalVersion[] = []
    const copies: string[] = []
    const cloudMarks: [number | null, string][] = []

    const record = (
        source: string,
        kind: LocalVersion['kind'],
        message: string,
    ): LocalVersion => {
        const v: LocalVersion = {
            localId: 'e1',
            n: versions.length + 1,
            kind,
            message,
            name: 'Corne',
            source,
            createdAt: 0,
        }
        versions.push(v)
        return v
    }

    const sync = createGitSync({
        api: async () => gh.api,
        entry: (id) => entries.get(id),
        saveLink: async (id, link) => {
            entries.set(id, { ...entries.get(id)!, git: link })
        },
        versions: async () => [...versions],
        putVersion: async (v) => {
            versions[v.n - 1] = v
        },
        applyGithub: async (id, source, message, sha) => {
            JSON.parse(source)
            entries.set(id, { ...entries.get(id)!, source })
            const v = record(source, 'github', message)
            v.gitSha = sha
            return v.n
        },
        saveCopy: async (_id, source) => {
            copies.push(source)
        },
        markCloud: async (_e, version, sha) => {
            cloudMarks.push([version, sha])
        },
        generator: 'remappr@test',
        now: () => 1,
    })

    const link = async (changes: Partial<GitLink> = {}): Promise<void> => {
        const e = entries.get('e1')!
        entries.set('e1', {
            ...e,
            git: {
                repo: 'o/r',
                branch: 'main',
                folder: 'remappr',
                target: null,
                autoPush: true,
                slug: 'corne',
                linkedAt: versions.length,
                ...changes,
            },
        })
    }

    return {
        gh,
        sync,
        link,
        versions,
        copies,
        cloudMarks,
        get: () => entries.get('e1')!,
        edit: (source: string) => {
            entries.set('e1', { ...entries.get('e1')!, source })
        },
        checkpoint: (message: string) =>
            record(entries.get('e1')!.source, 'checkpoint', message),
    }
}

describe('git sync: push', () => {
    it('pushes the current document on first sync, with source and manifest', async () => {
        const h = harness()
        await h.link()
        await h.sync.push('e1', { head: true })
        expect(h.gh.file('remappr/corne.remappr.json')).toBe(sourceText(doc(1)))
        const manifest = JSON.parse(h.gh.file(MANIFEST_PATH)!)
        expect(manifest.items[0]).toMatchObject({
            slug: 'corne',
            source: 'remappr/corne.remappr.json',
        })
        expect(h.get().git).toMatchObject({
            state: 'synced',
            lastSyncedSha: h.gh.head(),
        })
    })

    it('sends every saved version since the link, oldest first, with the trailer', async () => {
        const h = harness()
        await h.link()
        h.edit(doc(2))
        h.checkpoint('add layer')
        h.edit(doc(3))
        h.checkpoint('thumbs')
        await h.sync.push('e1')
        expect(h.gh.calls.commits).toBe(2)
        expect(h.gh.message()).toBe('thumbs\n\nRemappr-Version: 2')
        expect(h.versions.every((v) => v.gitSha)).toBe(true)
        expect(h.get().git?.syncedN).toBe(2)
        // Nothing left: a second push commits nothing.
        await h.sync.push('e1')
        expect(h.gh.calls.commits).toBe(2)
    })

    it('never pushes versions saved before the link', async () => {
        const h = harness()
        h.checkpoint('old')
        await h.link()
        await h.sync.push('e1')
        expect(h.gh.calls.commits).toBe(0)
        expect(h.get().git?.state).toBe('ahead')
    })

    it('keeps the outbox when offline and sends it later', async () => {
        const h = harness()
        await h.link()
        h.edit(doc(2))
        h.checkpoint('offline edit')
        const real = h.gh.api.branchHead
        h.gh.api.branchHead = async () => {
            throw new TypeError('Failed to fetch')
        }
        await expect(h.sync.push('e1')).rejects.toThrow()
        expect(h.get().git?.state).toBe('offline')
        h.gh.api.branchHead = real
        await h.sync.push('e1')
        expect(h.gh.message()).toBe('offline edit\n\nRemappr-Version: 1')
    })
})

describe('firstProblem', () => {
    it('names the first schema problem and where it is', () => {
        const err = Object.assign(new Error('x'), {
            issues: [
                {
                    message: 'unknown layer "base"',
                    path: ['combos', 0, 'layers', 0],
                },
            ],
        })
        expect(firstProblem(err)).toBe(
            'combos[0].layers[0]: unknown layer "base"',
        )
        expect(firstProblem(new SyntaxError('Unexpected token'))).toBe(
            'Unexpected token',
        )
    })
})

describe('git sync: an empty repo', () => {
    it('gets a first commit of its own, then the push', async () => {
        const gh = fakeGithub()
        gh.wipe()
        const h = harness(gh)
        await h.link()
        await h.sync.push('e1', { head: true })
        expect(h.gh.file('remappr/corne.remappr.json')).toBe(sourceText(doc(1)))
        expect(h.get().git?.state).toBe('synced')
    })
})

describe('git sync: pull', () => {
    it('reads nothing new while the branch is unchanged (ETag)', async () => {
        const h = harness()
        await h.link()
        await h.sync.push('e1', { head: true })
        await h.sync.pull('e1') // learns the ETag of the new head
        expect(await h.sync.pull('e1')).toBe('unchanged')
        expect(h.gh.calls.notModified).toBeGreaterThan(0)
    })

    it('takes a GitHub edit as a github version when nothing changed here', async () => {
        const h = harness()
        await h.link()
        await h.sync.push('e1', { head: true })
        h.gh.edit(
            'remappr/corne.remappr.json',
            sourceText(doc(9)),
            'tweak on web',
        )
        expect(await h.sync.pull('e1')).toBe('applied')
        expect(h.get().source).toBe(sourceText(doc(9)))
        const v = h.versions.at(-1)!
        expect(v).toMatchObject({ kind: 'github', gitSha: h.gh.head() })
        expect(v.message).toBe('tweak on web (GitHub, @octo)')
        expect(h.get().git?.state).toBe('synced')
    })

    it('ignores commits that leave the document alone', async () => {
        const h = harness()
        await h.link()
        await h.sync.push('e1', { head: true })
        h.gh.edit('notes.md', 'x')
        expect(await h.sync.pull('e1')).toBe('advanced')
        expect(h.get().git?.lastSyncedSha).toBe(h.gh.head())
    })

    it('raises a conflict when both sides changed the document', async () => {
        const h = harness()
        await h.link()
        await h.sync.push('e1', { head: true })
        h.gh.edit('remappr/corne.remappr.json', sourceText(doc(9)))
        h.edit(doc(5))
        expect(await h.sync.pull('e1')).toBe('conflict')
        expect(h.get().git?.state).toBe('conflict')
        // A push waits for the user.
        await h.sync.push('e1', { head: true })
        expect(h.gh.file('remappr/corne.remappr.json')).toBe(sourceText(doc(9)))
    })

    it("keep mine: commits this device's document on top of GitHub's", async () => {
        const h = harness()
        await h.link()
        await h.sync.push('e1', { head: true })
        h.gh.edit('remappr/corne.remappr.json', sourceText(doc(9)))
        h.edit(doc(5))
        await h.sync.pull('e1')
        await h.sync.resolveConflict('e1', 'mine')
        expect(h.gh.file('remappr/corne.remappr.json')).toBe(sourceText(doc(5)))
        expect(h.get().git?.state).toBe('synced')
    })

    it("take GitHub: the document becomes GitHub's", async () => {
        const h = harness()
        await h.link()
        await h.sync.push('e1', { head: true })
        h.gh.edit('remappr/corne.remappr.json', sourceText(doc(9)))
        h.edit(doc(5))
        await h.sync.pull('e1')
        await h.sync.resolveConflict('e1', 'theirs')
        expect(h.get().source).toBe(sourceText(doc(9)))
        expect(h.get().git?.state).toBe('synced')
    })

    it("keep both: GitHub's becomes a copy, this one is pushed", async () => {
        const h = harness()
        await h.link()
        await h.sync.push('e1', { head: true })
        h.gh.edit('remappr/corne.remappr.json', sourceText(doc(9)))
        h.edit(doc(5))
        await h.sync.pull('e1')
        await h.sync.resolveConflict('e1', 'both')
        expect(h.copies).toEqual([sourceText(doc(9))])
        expect(h.gh.file('remappr/corne.remappr.json')).toBe(sourceText(doc(5)))
    })

    it('a file already in the repo at link time is a conflict, not overwritten', async () => {
        const h = harness(
            fakeGithub({ 'remappr/corne.remappr.json': sourceText(doc(7)) }),
        )
        await h.link()
        expect(await h.sync.pull('e1')).toBe('conflict')
    })

    it('a document that does not parse is refused', async () => {
        const h = harness()
        await h.link()
        await h.sync.push('e1', { head: true })
        h.gh.edit('remappr/corne.remappr.json', '{ broken')
        await expect(h.sync.pull('e1')).rejects.toThrow(
            /not a valid Remappr document/,
        )
        expect(h.get().git?.state).toBe('error')
    })
})

describe('git sync: generated files edited on GitHub', () => {
    const seeded = async (): Promise<FakeGithub> => {
        const manifest = {
            generator: 'remappr@old',
            items: [
                {
                    slug: 'corne',
                    version: 1,
                    source: 'remappr/corne.remappr.json',
                    target: null,
                    generated: [
                        {
                            path: 'config/corne.keymap',
                            blob: await gitBlobSha('generated\n'),
                        },
                    ],
                },
            ],
        }
        return fakeGithub({
            'remappr/corne.remappr.json': sourceText(doc(1)),
            'config/corne.keymap': 'hand edited\n',
            [MANIFEST_PATH]: JSON.stringify(manifest),
        })
    }

    it('warns and holds the push', async () => {
        const h = harness(await seeded())
        await h.link()
        expect(await h.sync.pull('e1')).toBe('advanced')
        expect(h.get().git).toMatchObject({
            state: 'hand_edited',
            handEdited: ['config/corne.keymap'],
        })
        h.edit(doc(2))
        h.checkpoint('more')
        await h.sync.push('e1')
        expect(h.gh.calls.commits).toBe(0)
    })

    it('keep theirs: stops generating that file and pushes', async () => {
        const h = harness(await seeded())
        await h.link()
        await h.sync.pull('e1')
        await h.sync.resolveHandEdits('e1', 'keep')
        expect(h.get().git?.keepTheirs).toEqual(['config/corne.keymap'])
        expect(h.get().git?.state).toBe('synced')
        expect(h.gh.file('config/corne.keymap')).toBe('hand edited\n')
    })
})

describe('git sync: releases', () => {
    const zmkV1 = [
        'name: Build ZMK firmware',
        'on: [push, pull_request, workflow_dispatch]',
        'jobs:',
        '  build:',
        '    uses: zmkfirmware/zmk/.github/workflows/build-user-config.yml@v0.3',
        '',
    ].join('\n')
    const WF = '.github/workflows/build.yml'

    it('releases the synced commit, with no firmware workflow', async () => {
        const h = harness()
        await h.link()
        const made = await h.sync.release('e1', '0.1.0', '- first')
        expect(made).toMatchObject({ tag: 'v0.1.0', firmware: 'none' })
        expect(h.gh.releases[0]).toMatchObject({
            tag: 'v0.1.0',
            target: h.gh.head(),
            name: 'Corne v0.1.0',
            body: '- first',
        })
        expect(h.get().git?.lastRelease?.tag).toBe('v0.1.0')
    })

    it('upgrades a workflow Remappr wrote before releases, then tags that', async () => {
        const h = harness(fakeGithub({ [WF]: zmkV1 }))
        await h.link()
        const made = await h.sync.release('e1', '1.0.0', '')
        expect(made.firmware).toBe('attached')
        expect(h.gh.message()).toBe('Attach the firmware to GitHub Releases')
        expect(h.gh.file(WF)).toContain('remappr:release')
        expect(h.gh.releases[0].target).toBe(h.gh.head())
        expect(h.get().git?.lastSyncedSha).toBe(h.gh.head())
    })

    it('leaves a hand-edited workflow alone and says so', async () => {
        const h = harness(fakeGithub({ [WF]: `${zmkV1}# mine\n` }))
        await h.link()
        const before = h.gh.calls.commits
        const made = await h.sync.release('e1', '1.0.0', '')
        expect(made.firmware).toBe('manual')
        // Only the sync's own commit, no workflow change.
        expect(h.gh.calls.commits).toBe(before + 1)
        expect(h.gh.file(WF)).toBe(`${zmkV1}# mine\n`)
    })

    it('drafts the next version and the changes since the last release', async () => {
        const h = harness()
        await h.link()
        expect((await h.sync.releaseDraft('e1')).version).toBe('0.1.0')
        await h.sync.release('e1', '0.1.0', '')
        h.edit(doc(2))
        h.checkpoint('Add a thumb layer')
        await h.sync.push('e1')
        const draft = await h.sync.releaseDraft('e1')
        expect(draft.version).toBe('0.1.1')
        expect(draft.notes).toBe('- Add a thumb layer')
        expect(draft.releases.map((r) => r.tag)).toEqual(['v0.1.0'])
        // The document's own newer version wins.
        expect((await h.sync.releaseDraft('e1', '2.0.0')).version).toBe('2.0.0')
    })

    it('refuses while the entry conflicts with GitHub', async () => {
        const h = harness()
        await h.link()
        await h.sync.push('e1', { head: true })
        h.gh.edit('remappr/corne.remappr.json', sourceText(doc(9)))
        h.edit(doc(5))
        await expect(h.sync.release('e1', '0.1.0', '')).rejects.toThrow(
            /settle that first/,
        )
        expect(h.gh.releases).toEqual([])
    })

    it('refuses a version already released', async () => {
        const h = harness()
        await h.link()
        await h.sync.release('e1', '0.1.0', '')
        await expect(h.sync.release('e1', '0.1.0', '')).rejects.toThrow(
            /already released/,
        )
    })
})
