// Pattern check: Facade (Tier 1) — applied — one narrow GitHub client (branch
// head with ETag, tree, file, commit info, repo list, commit) in front of the
// REST endpoints, so the sync engine never shapes requests.
//
// What syncing a library entry with a GitHub branch needs (plan §6c A2). The
// commit itself reuses lib/githubBuild.ts commitFiles (one atomic commit via
// the Git Data API). `fetch` is injected for tests.
import { createGithubBuildClient, type BundleFile } from '@/lib/githubBuild'

const API = 'https://api.github.com'
const seg = (s: string): string => encodeURIComponent(s)
const refPath = (ref: string): string => ref.split('/').map(seg).join('/')
const pathOf = (p: string): string => p.split('/').map(seg).join('/')

export interface RepoRef {
    owner: string
    name: string
}

export function parseRepo(full: string): RepoRef {
    const [owner, name, ...rest] = full.trim().split('/')
    if (!owner || !name || rest.length > 0)
        throw new Error(`"${full}" is not owner/name`)
    return { owner, name }
}

export interface RepoInfo {
    fullName: string
    defaultBranch: string
    private: boolean
    /** The token may push here. */
    canPush: boolean
}

export type BranchHead =
    | { changed: false }
    | { changed: true; sha: string; etag: string | null }

export interface ReleaseAsset {
    name: string
    url: string
    size: number
}

export interface ReleaseInfo {
    tag: string
    name: string
    url: string
    createdAt: string
    assets: ReleaseAsset[]
}

export interface NewRelease {
    tag: string
    /** The commit the tag points at. */
    target: string
    name: string
    body: string
}

export interface CommitInfo {
    message: string
    author: string
    date: string
}

/** A GitHub reply that was not OK, with its status. */
export class GithubApiError extends Error {
    constructor(
        readonly status: number,
        message: string,
    ) {
        super(message)
        this.name = 'GithubApiError'
    }
}

export interface RepoApi {
    /** Repos this connection can reach (the app's installations, else the
     *  token's own repos), newest first. */
    listRepos(): Promise<RepoInfo[]>
    getRepo(full: string): Promise<RepoInfo>
    /** The branch head; `changed: false` when it still matches `etag`. */
    branchHead(full: string, branch: string, etag?: string): Promise<BranchHead>
    /** path → git blob sha of every file at a commit. */
    tree(full: string, sha: string): Promise<Map<string, string>>
    /** A file's text at a commit; null when it is not there. */
    readFile(full: string, path: string, ref: string): Promise<string | null>
    commitInfo(full: string, sha: string): Promise<CommitInfo>
    /** One commit on top of `parent` (RemoteMovedError when the branch moved). */
    commit(
        full: string,
        branch: string,
        parent: string,
        files: BundleFile[],
        message: string,
    ): Promise<string>
    /** Releases, newest first (drafts left out). */
    listReleases(full: string): Promise<ReleaseInfo[]>
    /** A published Release; GitHub makes its tag at `target`. */
    createRelease(full: string, release: NewRelease): Promise<ReleaseInfo>
    /** Commit subjects after `base` (a tag or sha) up to `head`, oldest
     *  first; with no base, the latest 30. */
    commitSubjects(
        full: string,
        base: string | null,
        head: string,
    ): Promise<string[]>
    /** The first commit of an empty repo (one file, on `branch`); its sha.
     *  The Git Data API cannot write to a repo with no commits. */
    initEmpty(
        full: string,
        branch: string,
        file: BundleFile,
        message: string,
    ): Promise<string>
}

/** The repo has no commits yet (GitHub answers 409). */
export const isEmptyRepo = (e: unknown): boolean =>
    e instanceof GithubApiError && e.status === 409

const base64 = (text: string): string => {
    let s = ''
    for (const b of new TextEncoder().encode(text)) s += String.fromCharCode(b)
    return btoa(s)
}

interface RawRelease {
    tag_name: string
    name: string | null
    html_url: string
    created_at: string
    draft: boolean
    assets: { name: string; browser_download_url: string; size: number }[]
}

const releaseInfo = (r: RawRelease): ReleaseInfo => ({
    tag: r.tag_name,
    name: r.name || r.tag_name,
    url: r.html_url,
    createdAt: r.created_at,
    assets: r.assets.map((a) => ({
        name: a.name,
        url: a.browser_download_url,
        size: a.size,
    })),
})

const subjectOf = (c: { commit: { message: string } }): string =>
    c.commit.message.split('\n')[0] ?? ''

interface RawRepo {
    full_name: string
    default_branch: string
    private: boolean
    permissions?: { push?: boolean }
}

const repoInfo = (r: RawRepo): RepoInfo => ({
    fullName: r.full_name,
    defaultBranch: r.default_branch,
    private: r.private,
    canPush: r.permissions?.push ?? false,
})

export function createRepoApi(
    token: string,
    fetchImpl: typeof fetch = (...a) => fetch(...a),
): RepoApi {
    const headers = {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
    }

    async function send(path: string, extra?: HeadersInit): Promise<Response> {
        const res = await fetchImpl(`${API}${path}`, {
            headers: { ...headers, ...extra },
            // The ETag is ours to send; the browser cache must not answer.
            cache: 'no-store',
        })
        if (res.ok || res.status === 304 || res.status === 404) return res
        const detail = await res.text().catch(() => '')
        throw new GithubApiError(
            res.status,
            `GitHub GET ${path} → ${res.status}${detail ? `: ${detail}` : ''}`,
        )
    }

    async function json<T>(path: string): Promise<T> {
        const res = await send(path)
        if (res.status === 404)
            throw new GithubApiError(404, `GitHub GET ${path} → 404`)
        return (await res.json()) as T
    }

    const repoPath = (full: string): string => {
        const { owner, name } = parseRepo(full)
        return `/repos/${seg(owner)}/${seg(name)}`
    }

    async function installationRepos(): Promise<RepoInfo[] | null> {
        const res = await send('/user/installations?per_page=100')
        if (res.status === 404) return null
        const { installations } = (await res.json()) as {
            installations: { id: number }[]
        }
        // A personal access token has no installations: use its own repos.
        if (installations.length === 0) return null
        const lists = await Promise.all(
            installations.map((i) =>
                json<{ repositories: RawRepo[] }>(
                    `/user/installations/${i.id}/repositories?per_page=100`,
                ),
            ),
        )
        return lists.flatMap((l) => l.repositories.map(repoInfo))
    }

    return {
        async listRepos() {
            const viaApp = await installationRepos().catch(() => null)
            if (viaApp) return viaApp
            const own = await json<RawRepo[]>(
                '/user/repos?per_page=100&sort=updated',
            )
            return own.map(repoInfo)
        },
        async getRepo(full) {
            return repoInfo(await json<RawRepo>(repoPath(full)))
        },
        async branchHead(full, branch, etag) {
            const res = await send(
                `${repoPath(full)}/commits/${refPath(branch)}`,
                {
                    Accept: 'application/vnd.github.sha',
                    ...(etag ? { 'If-None-Match': etag } : {}),
                },
            )
            if (res.status === 304) return { changed: false }
            if (res.status === 404)
                throw new GithubApiError(
                    404,
                    `Branch "${branch}" is not in ${full}.`,
                )
            return {
                changed: true,
                sha: (await res.text()).trim(),
                etag: res.headers.get('ETag'),
            }
        },
        async tree(full, sha) {
            const { tree, truncated } = await json<{
                tree: { path: string; type: string; sha: string }[]
                truncated: boolean
            }>(`${repoPath(full)}/git/trees/${seg(sha)}?recursive=1`)
            if (truncated)
                throw new Error(`${full} is too large to sync file by file.`)
            return new Map(
                tree
                    .filter((t) => t.type === 'blob')
                    .map((t) => [t.path, t.sha]),
            )
        },
        async readFile(full, path, ref) {
            const res = await send(
                `${repoPath(full)}/contents/${pathOf(path)}?ref=${seg(ref)}`,
                { Accept: 'application/vnd.github.raw+json' },
            )
            if (res.status === 404) return null
            return res.text()
        },
        async commitInfo(full, sha) {
            const c = await json<{
                commit: {
                    message: string
                    author: { name: string; date: string } | null
                }
                author: { login: string } | null
            }>(`${repoPath(full)}/commits/${seg(sha)}`)
            return {
                message: c.commit.message,
                author: c.author?.login ?? c.commit.author?.name ?? '',
                date: c.commit.author?.date ?? '',
            }
        },
        async listReleases(full) {
            const list = await json<RawRelease[]>(
                `${repoPath(full)}/releases?per_page=20`,
            )
            return list.filter((r) => !r.draft).map(releaseInfo)
        },
        async createRelease(full, release) {
            const res = await fetchImpl(`${API}${repoPath(full)}/releases`, {
                method: 'POST',
                headers: { ...headers, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    tag_name: release.tag,
                    target_commitish: release.target,
                    name: release.name,
                    body: release.body,
                }),
            })
            if (!res.ok) {
                const detail = await res.text().catch(() => '')
                throw new GithubApiError(
                    res.status,
                    /already_exists/.test(detail)
                        ? `${release.tag} is already released on GitHub.`
                        : `GitHub POST releases → ${res.status}${detail ? `: ${detail}` : ''}`,
                )
            }
            return releaseInfo((await res.json()) as RawRelease)
        },
        async commitSubjects(full, base, head) {
            if (!base) {
                const list = await json<{ commit: { message: string } }[]>(
                    `${repoPath(full)}/commits?sha=${seg(head)}&per_page=30`,
                )
                return list.map(subjectOf).reverse()
            }
            const cmp = await json<{
                commits: { commit: { message: string } }[]
            }>(`${repoPath(full)}/compare/${seg(base)}...${seg(head)}`)
            return cmp.commits.map(subjectOf)
        },
        async initEmpty(full, branch, file, message) {
            const res = await fetchImpl(
                `${API}${repoPath(full)}/contents/${pathOf(file.path)}`,
                {
                    method: 'PUT',
                    headers: { ...headers, 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        message,
                        branch,
                        content: base64(file.content),
                    }),
                },
            )
            if (!res.ok) {
                const detail = await res.text().catch(() => '')
                throw new GithubApiError(
                    res.status,
                    `GitHub PUT ${file.path} → ${res.status}${detail ? `: ${detail}` : ''}`,
                )
            }
            const body = (await res.json()) as { commit: { sha: string } }
            return body.commit.sha
        },
        async commit(full, branch, parent, files, message) {
            const { owner, name } = parseRepo(full)
            const client = createGithubBuildClient(token, fetchImpl)
            const { commitSha } = await client.commitFiles(
                owner,
                name,
                branch,
                files,
                message,
                parent,
            )
            return commitSha
        },
    }
}
