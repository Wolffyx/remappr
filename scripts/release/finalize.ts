// Pattern check: no GoF pattern (-) — rejected — thin script: fetch releases/commits, hand them to notes.ts, write a file.
//
// Run by release.yml while the new release is still a draft:
//   node scripts/release/finalize.ts
// Env:
//   GITHUB_REPOSITORY  owner/repo of the app
//   TAG                the new release's tag (draft)
//   GH_TOKEN           reads the app's draft release (contents: write)
//   SIBLING_TOKEN      reads the sibling repos, the builder is private
//   OUT                where to write the finished release body
// A sibling that can't be read is left out of the notes and the lock (and
// logged); the release still goes out.
import { writeFileSync } from 'node:fs'
import {
    buildReleaseBody,
    type Commit,
    type Lock,
    readLock,
    type Sibling,
    SIBLINGS,
} from './notes.ts'

interface Release {
    tag_name: string
    body: string | null
    draft: boolean
    prerelease: boolean
    published_at: string | null
}

const env = (name: string): string => {
    const value = process.env[name]
    if (!value) throw new Error(`${name} is not set`)
    return value
}

async function api<T>(path: string, token: string): Promise<T> {
    const res = await fetch(`https://api.github.com/${path}`, {
        headers: {
            Accept: 'application/vnd.github+json',
            Authorization: `Bearer ${token}`,
        },
    })
    if (!res.ok) throw new Error(`GET ${path}: HTTP ${res.status}`)
    return (await res.json()) as T
}

/** The draft being finalized and the published release before it. */
async function findReleases(
    repo: string,
    tag: string,
    token: string,
): Promise<{ current: Release; previous: Release | undefined }> {
    // Newest first; drafts are only listed for a token with write access.
    const releases = await api<Release[]>(
        `repos/${repo}/releases?per_page=50`,
        token,
    )
    const index = releases.findIndex((r) => r.tag_name === tag)
    if (index < 0) throw new Error(`no release ${tag} in ${repo}`)
    const previous = releases
        .slice(index + 1)
        .find((r) => !r.draft && !r.prerelease)
    return { current: releases[index], previous }
}

/** Commits on a sibling since the previous release, and its head now. The
 *  previous release's lock gives the start; before locks existed, the last
 *  commit before that release was published stands in. */
async function siblingCommits(
    sibling: Sibling,
    previous: Release | undefined,
    token: string,
): Promise<{ head: string; commits: Commit[] }> {
    const { default_branch: branch } = await api<{ default_branch: string }>(
        `repos/${sibling.repo}`,
        token,
    )
    const { sha: head } = await api<{ sha: string }>(
        `repos/${sibling.repo}/commits/${branch}`,
        token,
    )
    let base = readLock(previous?.body)?.[sibling.name]
    if (!base && previous?.published_at) {
        const before = await api<{ sha: string }[]>(
            `repos/${sibling.repo}/commits?sha=${branch}&until=${previous.published_at}&per_page=1`,
            token,
        )
        base = before[0]?.sha
    }
    if (!base || base === head) return { head, commits: [] }
    const compare = await api<{
        commits: {
            sha: string
            html_url: string
            commit: { message: string }
        }[]
    }>(`repos/${sibling.repo}/compare/${base}...${head}`, token)
    return {
        head,
        commits: compare.commits.map((c) => ({
            sha: c.sha,
            message: c.commit.message,
            url: c.html_url,
        })),
    }
}

async function main(): Promise<void> {
    const repo = env('GITHUB_REPOSITORY')
    const tag = env('TAG')
    const { current, previous } = await findReleases(repo, tag, env('GH_TOKEN'))
    console.log(`${tag}: previous release ${previous?.tag_name ?? '(none)'}`)

    const siblingToken = env('SIBLING_TOKEN')
    const lock: Lock = {}
    const found: { sibling: Sibling; commits: Commit[] }[] = []
    for (const sibling of SIBLINGS) {
        try {
            const { head, commits } = await siblingCommits(
                sibling,
                previous,
                siblingToken,
            )
            lock[sibling.name] = head
            found.push({ sibling, commits })
            console.log(`${sibling.name}: ${head} (${commits.length} commits)`)
        } catch (err) {
            console.log(
                `::warning::${sibling.name}: left out of the notes — ${err}`,
            )
        }
    }

    const body = buildReleaseBody(current.body ?? '', found, lock)
    writeFileSync(env('OUT'), body)
    console.log(body)
}

await main()
