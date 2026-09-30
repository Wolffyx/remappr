# Releasing Remappr

A release is a batch of work, shipped deliberately: the desktop installers,
remappr.com and the release notes all come from the same commits.

## The flow

1. Feature and fix PRs merge into **`dev`**. Every push to `dev` redeploys
   staging at **dev.remappr.com** (`dev-deploy.yml`); nothing is released.
2. When the batch is ready, promote the sibling repos first (below), then open
   **one PR into `main`** in this repo: from the feature branch that already
   went into `dev`, or `dev` itself.
3. Merge it with **"Create a merge commit"**, never squash. release-please
   reads the individual conventional commits to pick the version and write the
   notes; a squash hands it a single commit (the PR title) instead.
4. That's the release. `release.yml` then, without further input:
    - opens the release-please PR and auto-merges it,
    - creates the GitHub release as a **draft**,
    - adds the sibling repos' changes to the notes and records the sibling
      commits it was built from (`scripts/release/`),
    - publishes it, which fires:
        - `build-release.yml`: Windows / macOS / Linux installers,
        - `main.yml`: remappr.com,
        - `docs.yml`: the docs' What's new page,
        - `discord-release.yml`: the announcement, with an `@everyone` ping.
    - merges `main` back into `dev` (the `sync-dev` job), so `dev` has the
      release commit and anything that went straight into `main`. If the two
      conflict, it opens a PR `chore/merge-vX.Y.Z-into-dev` → `dev` instead;
      resolve it there and merge with a merge commit.

Anything merged into `main` releases the same way. A hotfix can branch from
`main` and merge straight back, no promotion needed; `sync-dev` brings it into
`dev` with the release. A docs-only change can too: `docs.yml` deploys it, and
with no `feat` / `fix` in it, no release is cut, so nothing syncs it into
`dev` until the next release.

## Versions

release-please derives the version from the batch's commit types:

| In the batch               | 0.x (now)  | from 1.0   |
| -------------------------- | ---------- | ---------- |
| a `feat`                   | minor      | minor      |
| only `fix` / `perf`        | patch      | patch      |
| a breaking change (`!`)    | minor      | major      |
| only `chore`/`ci`/`docs`/… | no release | no release |

To force a version, run the **release** workflow by hand with `release_as`
(e.g. `0.2.0`). It pushes an empty `Release-As:` commit to `main`, and the
next release uses that number.

## Sibling repos

The app is built with three repos linked in as source
(`scripts/link-remappr.cjs`): `remapprClientFirmware`, `remapprUI` and the
private `remapprBuilder`. A release takes each one's **default branch** as it
is at release time, so promote their `dev` → `main` before the app's.

The notes list their `feat` / `fix` / `perf` commits since the previous release
under the same headings as the app's, scoped by repo (`firmware/vial: …`),
skipping any whose subject or `#issue` the app already lists. Builder entries
have no commit links, since the repo is private.

The commits a release was built from are recorded in its body as a hidden
line:

```
<!-- remappr-lock {"firmware":"<sha>","ui":"<sha>","builder":"<sha>"} -->
```

The installers and remappr.com build exactly those commits, and the next
release lists sibling changes from there. Leave the line in if you edit a
release's notes.

## Manual redeploys

- **remappr.com**: run `main.yml` by hand; it redeploys the latest release.
- **docs.remappr.com**: deploys on every docs change on `main` and on each
  release, or run `docs.yml` by hand.
- **dev.remappr.com**: run `dev-deploy.yml` by hand.

## One-time setup

- The `github-pages` environment must allow **`v*` tags** as well as `main`:
  the site deploys from the release tag.
- `DISCORD_WEBHOOK_URL` in the `remappr` environment; the webhook needs
  _Mention @everyone, @here and All Roles_ in its channel, otherwise it posts
  without the ping.
