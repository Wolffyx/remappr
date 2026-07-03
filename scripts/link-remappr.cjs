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
const { execSync } = require('node:child_process')

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

function wireSymlink(linkAbs, targetAbs) {
    fs.rmSync(linkAbs, { recursive: true, force: true })
    fs.mkdirSync(path.dirname(linkAbs), { recursive: true })
    fs.symlinkSync(path.relative(path.dirname(linkAbs), targetAbs), linkAbs)
}

function writeBuilderStub(linkAbs) {
    fs.rmSync(linkAbs, { recursive: true, force: true })
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

// Branch/tag to fetch for a project: per-project REMAPPR_<NAME>_REF wins over
// the global REMAPPR_REF; unset -> the repo's default branch. This lets the
// app's `dev` build pull each project's `dev` branch (dev-deploy.yml sets
// REMAPPR_REF=dev) while main/prod builds stay on the default branch.
function refFor(t) {
    return (
        process.env[`REMAPPR_${t.name.toUpperCase()}_REF`] ||
        process.env.REMAPPR_REF ||
        ''
    )
}

function tryClone(t) {
    const ref = refFor(t)
    // Cache per ref so switching branches locally doesn't serve a stale clone.
    const dest = path.join(cacheRoot, ref ? `${t.repoDir}@${ref}` : t.repoDir)
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
    // With a ref, try that branch first; if the project hasn't branched it yet
    // (e.g. `dev` not yet cut from main) fall back to the default branch so the
    // build still succeeds instead of hard-failing on a missing branch.
    const attempts = ref ? [`--branch ${ref} `, ''] : ['']
    for (const branchArg of attempts) {
        try {
            execSync(`git clone --depth 1 ${branchArg}${url} "${dest}"`, {
                stdio: 'inherit',
            })
            if (ref && branchArg === '') {
                console.log(
                    `[link-remappr] ${t.name}: ref "${ref}" not found — used the default branch.`,
                )
            }
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
