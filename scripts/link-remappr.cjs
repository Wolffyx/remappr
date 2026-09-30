#!/usr/bin/env node
/*
 * Wire the extracted @remappr/* projects into this app so it builds everywhere:
 * local dev, a fresh `git clone` + install, and CI.
 *
 * Each consumed folder is resolved to ONE source, in priority order:
 *   1. sibling repo in the Remappr/ umbrella   -> live source (local dev:
 *      edit-in-app, push-from-repo).
 *   2. local clone cache (.remappr/<repo>)     -> already fetched.
 *   3. git clone the project into the cache     -> fresh download / CI. This is
 *      the "something that fetches the projects" so the app works on download.
 *   4. (builder only) a generated stub          -> builder is OPTIONAL and
 *      access-gated; if its private repo can't be cloned, the app still builds.
 *
 * The wired paths + the .remappr cache are git-ignored (generated, not stored).
 * Override a project URL with env REMAPPR_<NAME>_URL; skip all network with
 * REMAPPR_NO_FETCH=1 (then only umbrella/cache are used).
 *
 * Auth: PUBLIC projects (firmware, ui) clone anonymously — no token needed.
 * PRIVATE projects (builder) are marked `private` and only clone when a token is
 * present (env REMAPPR_GIT_TOKEN or GITHUB_TOKEN); without it they fall back to
 * the stub. A token, when set, is injected into the https URL for any project.
 */
const fs = require('node:fs')
const path = require('node:path')
const { execFileSync } = require('node:child_process')

const appRoot = path.resolve(__dirname, '..')
// app = .../Typescript/React/zmk-studio-original  ->  ../../ = .../Typescript
const umbrella = path.resolve(appRoot, '..', '..', 'Remappr')
const cacheRoot = path.join(appRoot, '.remappr')

const targets = [
    {
        name: 'firmware',
        link: 'src/firmware',
        repoDir: 'remapprClientFirmware',
        srcSub: 'src',
        url: 'https://github.com/Wolffyx/remapprClientFirmware.git',
    },
    {
        name: 'ui',
        link: 'src/renderer/src/ui',
        repoDir: 'remapprUI', // remote: github.com/Wolffyx/remapprUI
        umbrellaDir: 'remappr-ui', // local umbrella folder name
        srcSub: 'src/ui',
        url: 'https://github.com/Wolffyx/remapprUI.git',
    },
    {
        name: 'builder',
        link: 'src/renderer/src/features/builder',
        repoDir: 'remapprBuilder',
        srcSub: 'src/features/builder',
        url: 'https://github.com/Wolffyx/remapprBuilder.git',
        optional: true,
        private: true,
    },
]

const noFetch = process.env.REMAPPR_NO_FETCH === '1'
const gitToken = process.env.REMAPPR_GIT_TOKEN || process.env.GITHUB_TOKEN || ''

// Inject a token into an https github URL so private repos can be cloned in CI.
function authUrl(url) {
    if (!gitToken) return url
    return url.replace(
        /^https:\/\/github\.com\//,
        `https://x-access-token:${gitToken}@github.com/`,
    )
}

// rmSync follows a symlink, so a dangling one (its clone was deleted) survives
// it and the new symlinkSync fails with EEXIST; unlink the link itself first.
function removeLink(linkAbs) {
    const stat = fs.lstatSync(linkAbs, { throwIfNoEntry: false })
    if (stat?.isSymbolicLink()) fs.unlinkSync(linkAbs)
    fs.rmSync(linkAbs, { recursive: true, force: true })
}

function wireSymlink(linkAbs, targetAbs) {
    removeLink(linkAbs)
    fs.mkdirSync(path.dirname(linkAbs), { recursive: true })
    fs.symlinkSync(path.relative(path.dirname(linkAbs), targetAbs), linkAbs)
}

function writeBuilderStub(linkAbs) {
    removeLink(linkAbs)
    fs.mkdirSync(linkAbs, { recursive: true })
    fs.writeFileSync(
        path.join(linkAbs, 'index.tsx'),
        [
            '// Generated stub: the builder is an optional, access-gated project',
            '// (@remappr/builder) that was not found. The builder UI is disabled.',
            'export function Builder(): null {',
            '    return null',
            '}',
            '',
        ].join('\n'),
    )
}

// Refs to fetch for a project, tried in order, then the repo's default branch:
// per-project REMAPPR_<NAME>_REF wins over the global REMAPPR_REF, and either
// may list several, comma-separated. So:
//   - dev-deploy.yml sets REMAPPR_REF=dev: staging pulls each project's `dev`.
//   - PR builds set "<pr branch>,<base branch>": a feature that spans repos
//     under one branch name builds against its sibling branches before any of
//     them merge; otherwise against the siblings' branch matching the target.
//   - Release builds set a full commit SHA per project (the release's
//     remappr-lock, see scripts/release/) so every artifact of a release builds
//     the same sources.
// Unset -> the default branch, so main/prod builds stay there.
function refsFor(t) {
    const raw =
        process.env[`REMAPPR_${t.name.toUpperCase()}_REF`] ||
        process.env.REMAPPR_REF ||
        ''
    return raw
        .split(',')
        .map((ref) => ref.trim())
        .filter((ref) => {
            if (!ref) return false
            // Refs can come from a PR's branch name; keep them to plain
            // branch/tag characters (git runs without a shell anyway).
            if (/^[A-Za-z0-9._/-]+$/.test(ref) && !ref.startsWith('-')) {
                return true
            }
            console.warn(`[link-remappr] ignoring unusable ref "${ref}"`)
            return false
        })
}

const isSha = (ref) => /^[0-9a-f]{40}$/.test(ref)

const git = (args) => execFileSync('git', args, { stdio: 'inherit' })

// A pinned commit: `git clone --branch` takes only branches and tags, so fetch
// the one commit instead. No fallback — a release must not quietly build
// different sources than it recorded.
function fetchCommit(t, url, dest, sha) {
    try {
        fs.mkdirSync(dest, { recursive: true })
        git(['-C', dest, 'init', '--quiet'])
        git(['-C', dest, 'remote', 'add', 'origin', url])
        git(['-C', dest, 'fetch', '--quiet', '--depth', '1', 'origin', sha])
        git(['-C', dest, 'checkout', '--quiet', 'FETCH_HEAD'])
        return dest
    } catch {
        fs.rmSync(dest, { recursive: true, force: true })
        console.error(
            `[link-remappr] ERROR: ${t.name}: pinned commit ${sha} could not be fetched.`,
        )
        process.exitCode = 1
        return null
    }
}

function tryClone(t) {
    const refs = refsFor(t)
    // Cache per ref list so switching branches locally doesn't serve a stale
    // clone.
    const key = refs.join('+').replace(/\//g, '_')
    const dest = path.join(cacheRoot, key ? `${t.repoDir}@${key}` : t.repoDir)
    if (fs.existsSync(path.join(dest, t.srcSub))) return dest // cached
    if (noFetch) return null
    // Private projects need a token; without one, skip (optional -> stub).
    if (t.private && !gitToken) {
        console.log(
            `[link-remappr] ${t.name} is private and no token (REMAPPR_GIT_TOKEN/GITHUB_TOKEN) is set — skipping fetch.`,
        )
        return null
    }
    const baseUrl = process.env[`REMAPPR_${t.name.toUpperCase()}_URL`] || t.url
    const url = authUrl(baseUrl)
    fs.mkdirSync(cacheRoot, { recursive: true })
    fs.rmSync(dest, { recursive: true, force: true })
    if (refs.length === 1 && isSha(refs[0])) {
        return fetchCommit(t, url, dest, refs[0])
    }
    // Each listed branch in turn; a project that hasn't cut one (e.g. `dev`
    // not yet branched from main) falls through to its default branch, so the
    // build still succeeds instead of hard-failing on a missing branch.
    for (const ref of [...refs, null]) {
        const branch = ref ? ['--branch', ref] : []
        try {
            git(['clone', '--quiet', '--depth', '1', ...branch, url, dest])
            console.log(
                `[link-remappr] ${t.name}: ${ref ? `branch "${ref}"` : 'default branch'}`,
            )
            return dest
        } catch {
            fs.rmSync(dest, { recursive: true, force: true })
        }
    }
    return null
}

for (const t of targets) {
    const linkAbs = path.join(appRoot, t.link)
    const fromUmbrella = path.join(
        umbrella,
        t.umbrellaDir || t.repoDir,
        t.srcSub,
    )

    if (fs.existsSync(fromUmbrella)) {
        wireSymlink(linkAbs, fromUmbrella)
        console.log(`[link-remappr] ${t.name} -> umbrella repo (live source)`)
        continue
    }

    const cloned = tryClone(t)
    if (cloned && fs.existsSync(path.join(cloned, t.srcSub))) {
        wireSymlink(linkAbs, path.join(cloned, t.srcSub))
        console.log(`[link-remappr] ${t.name} -> fetched clone (.remappr)`)
        continue
    }

    if (t.optional) {
        writeBuilderStub(linkAbs)
        console.log(`[link-remappr] ${t.name} -> stub (optional, unavailable)`)
        continue
    }

    console.error(
        `[link-remappr] ERROR: could not resolve required project "${t.name}". ` +
            `Clone it into ${umbrella}/${t.umbrellaDir || t.repoDir} or check network/access.`,
    )
    process.exitCode = 1
}
