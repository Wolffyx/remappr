// Pattern check: no GoF pattern (-) — rejected — a thin closure-based REST client
// over an injected fetch; HTTP request shaping, no abstraction or polymorphism.
//
// Minimal GitHub REST client for the Phase-1 cloud-build convenience path: push a
// generated project bundle to the user's own repo, let Actions build it, then
// fetch the firmware artifact. Auth is a personal access token (repo + workflow
// scopes) — no OAuth backend needed for an owner tool. `fetch` is injected so the
// request shaping is unit-testable without network. GitHub's REST API sends CORS
// headers, so the JSON calls run fine from the renderer. The artifact *download*
// does not (api.github.com 302-redirects to a no-CORS signed blob URL), so it
// goes through an injected downloader — main-process proxy on desktop, direct
// fetch on web. (Distinct from lib/github.ts, which only reads this app's own
// GitHub Releases for self-update.)

import { IpcChannels } from '@shared/ipc-types'

const API = 'https://api.github.com'

// Encode a single path identifier (owner / repo / name) before interpolating it
// into a request path, so a value with a URL-special char can't malform the path.
const seg = (s: string): string => encodeURIComponent(s)
// Encode a git branch as a ref path: each slash-separated piece is encoded but the
// slashes are kept, since GitHub's ref API treats `heads/feature/x` as a
// multi-segment ref — so `feature/x` resolves correctly and odd chars still escape.
const refPath = (branch: string): string => branch.split('/').map(seg).join('/')

export interface BundleFile {
    /** Path within the repo, e.g. "config/board.keymap". */
    path: string
    content: string
}

/** The branch moved since the commit a push was built on: pull first. */
export class RemoteMovedError extends Error {
    constructor(readonly head: string) {
        super('The branch changed on GitHub since the last sync.')
        this.name = 'RemoteMovedError'
    }
}

export interface WorkflowRun {
    id: number
    status: string // queued | in_progress | completed
    conclusion: string | null // success | failure | … (null until completed)
    htmlUrl: string
}

export interface Artifact {
    id: number
    name: string
    archiveDownloadUrl: string
}

// pattern-check: skip — remove localStorage token helpers; token now lives in
// lib/secretStore (safeStorage on desktop). Interface below is unchanged.
export interface GithubBuildClient {
    getUser(): Promise<{ login: string }>
    ensureRepo(
        name: string,
        opts?: { private?: boolean },
    ): Promise<{ owner: string; name: string; defaultBranch: string }>
    commitFiles(
        owner: string,
        repo: string,
        branch: string,
        files: BundleFile[],
        message: string,
        /** Commit only on top of this commit; RemoteMovedError otherwise. */
        parent?: string,
    ): Promise<{ commitSha: string }>
    /** Latest workflow run, optionally scoped to a specific pushed commit
     *  (`headSha`) so polling never latches onto a stale prior run. */
    getLatestRun(
        owner: string,
        repo: string,
        headSha?: string,
    ): Promise<WorkflowRun | null>
    listArtifacts(
        owner: string,
        repo: string,
        runId: number,
    ): Promise<Artifact[]>
    downloadArtifact(url: string): Promise<Uint8Array>
}

// pattern-check: skip — DI seam (injected downloader fn) matching the existing
// fetchImpl injection; a function factory, not a GoF pattern.
/** Fetches an artifact zip given its api.github.com download URL → raw bytes.
 *  Injected so desktop can route around CORS via the main process. */
export type ArtifactDownloader = (url: string) => Promise<Uint8Array>

/** Downloader that proxies through the Electron main process (no CORS, token
 *  read from the OS secret store there). Returns null on web / when the IPC
 *  bridge isn't exposed, so callers can fall back to a direct fetch. */
export function electronArtifactDownloader(): ArtifactDownloader | null {
    const api = (
        globalThis as {
            api?: {
                invoke(channel: string, ...args: unknown[]): Promise<unknown>
            }
        }
    ).api
    if (!api || typeof api.invoke !== 'function') return null
    return async (url) => {
        const bytes = await api.invoke(IpcChannels.GITHUB_DOWNLOAD_ARTIFACT, {
            url,
        })
        if (bytes instanceof Uint8Array) return bytes
        // Structured-clone may surface an ArrayBuffer / typed view.
        if (bytes instanceof ArrayBuffer) return new Uint8Array(bytes)
        throw new Error('artifact download failed in main process')
    }
}

export function createGithubBuildClient(
    token: string,
    fetchImpl: typeof fetch = fetch,
    download?: ArtifactDownloader,
): GithubBuildClient {
    const headers = {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
    }

    async function req<T>(
        method: string,
        path: string,
        body?: unknown,
    ): Promise<T> {
        const res = await fetchImpl(`${API}${path}`, {
            method,
            headers: body
                ? { ...headers, 'Content-Type': 'application/json' }
                : headers,
            body: body ? JSON.stringify(body) : undefined,
        })
        if (!res.ok) {
            const detail = await res.text().catch(() => '')
            throw new Error(
                `GitHub ${method} ${path} → ${res.status}${detail ? `: ${detail}` : ''}`,
            )
        }
        return (await res.json()) as T
    }

    const getUser: GithubBuildClient['getUser'] = () =>
        req<{ login: string }>('GET', '/user')

    const ensureRepo: GithubBuildClient['ensureRepo'] = async (name, opts) => {
        const { login } = await getUser()
        const res = await fetchImpl(`${API}/repos/${seg(login)}/${seg(name)}`, {
            headers,
        })
        if (res.ok) {
            const repo = (await res.json()) as { default_branch: string }
            return { owner: login, name, defaultBranch: repo.default_branch }
        }
        // Only a genuine 404 means "missing → create". Any other failure (401
        // bad token, 403 rate-limit) must surface, not fall through to creating
        // a repo we couldn't prove was absent.
        if (res.status !== 404) {
            const detail = await res.text().catch(() => '')
            throw new Error(
                `GitHub GET /repos/${login}/${name} → ${res.status}${detail ? `: ${detail}` : ''}`,
            )
        }
        // 404 → create it (auto-init so a default branch + base commit exist).
        const created = await req<{ default_branch: string }>(
            'POST',
            '/user/repos',
            { name, private: opts?.private ?? true, auto_init: true },
        )
        return { owner: login, name, defaultBranch: created.default_branch }
    }

    // Atomic multi-file commit via the Git Data API: tree entries carry inline
    // content (no separate blob uploads), then a commit advances the branch ref.
    const commitFiles: GithubBuildClient['commitFiles'] = async (
        owner,
        repo,
        branch,
        files,
        message,
        parent,
    ) => {
        const ref = await req<{ object: { sha: string } }>(
            'GET',
            `/repos/${seg(owner)}/${seg(repo)}/git/ref/heads/${refPath(branch)}`,
        )
        const baseSha = ref.object.sha
        if (parent && baseSha !== parent) throw new RemoteMovedError(baseSha)
        const baseCommit = await req<{ tree: { sha: string } }>(
            'GET',
            `/repos/${seg(owner)}/${seg(repo)}/git/commits/${seg(baseSha)}`,
        )
        const tree = await req<{ sha: string }>(
            'POST',
            `/repos/${seg(owner)}/${seg(repo)}/git/trees`,
            {
                base_tree: baseCommit.tree.sha,
                tree: files.map((f) => ({
                    path: f.path,
                    mode: '100644',
                    type: 'blob',
                    content: f.content,
                })),
            },
        )
        const commit = await req<{ sha: string }>(
            'POST',
            `/repos/${seg(owner)}/${seg(repo)}/git/commits`,
            { message, tree: tree.sha, parents: [baseSha] },
        )
        // Not forced: a commit that landed meanwhile makes this a 422, never
        // a lost commit.
        await req(
            'PATCH',
            `/repos/${seg(owner)}/${seg(repo)}/git/refs/heads/${refPath(branch)}`,
            { sha: commit.sha, force: false },
        ).catch((e: unknown) => {
            if (parent && /→ 422/.test(String(e)))
                throw new RemoteMovedError(baseSha)
            throw e
        })
        return { commitSha: commit.sha }
    }

    const getLatestRun: GithubBuildClient['getLatestRun'] = async (
        owner,
        repo,
        headSha,
    ) => {
        // Scope to the just-pushed commit when known: otherwise the newest run
        // might be a leftover from a previous push (whose stale "completed"
        // conclusion would end polling against the wrong build).
        const query = headSha
            ? `?head_sha=${encodeURIComponent(headSha)}&per_page=1`
            : `?per_page=1`
        const res = await req<{
            workflow_runs: {
                id: number
                status: string
                conclusion: string | null
                html_url: string
            }[]
        }>('GET', `/repos/${seg(owner)}/${seg(repo)}/actions/runs${query}`)
        const run = res.workflow_runs[0]
        if (!run) return null
        return {
            id: run.id,
            status: run.status,
            conclusion: run.conclusion,
            htmlUrl: run.html_url,
        }
    }

    const listArtifacts: GithubBuildClient['listArtifacts'] = async (
        owner,
        repo,
        runId,
    ) => {
        const res = await req<{
            artifacts: {
                id: number
                name: string
                archive_download_url: string
            }[]
        }>(
            'GET',
            `/repos/${seg(owner)}/${seg(repo)}/actions/runs/${runId}/artifacts`,
        )
        return res.artifacts.map((a) => ({
            id: a.id,
            name: a.name,
            archiveDownloadUrl: a.archive_download_url,
        }))
    }

    const downloadArtifact: GithubBuildClient['downloadArtifact'] = async (
        url,
    ) => {
        // Prefer the injected downloader (desktop → main-process proxy, no CORS).
        // Direct fetch is the web fallback: api.github.com sends CORS, but the
        // 302 target (signed blob URL) usually does not, so this can fail in the
        // browser — the desktop proxy is the supported path.
        if (download) return download(url)
        const res = await fetchImpl(url, { headers })
        if (!res.ok) throw new Error(`GitHub artifact download → ${res.status}`)
        return new Uint8Array(await res.arrayBuffer())
    }

    return {
        getUser,
        ensureRepo,
        commitFiles,
        getLatestRun,
        listArtifacts,
        downloadArtifact,
    }
}
