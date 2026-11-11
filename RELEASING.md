# Releasing Remappr

A release is a batch of work, shipped deliberately: the desktop installers,
remappr.com and the release notes all come from the same commits.

## The flow

Every change, feature or quick fix, travels on its own branch, and only `dev`
ever merges into `main`:

1. **Branch from `main`**, so a branch starts from what is released and
   carries nothing else that is waiting on `dev`.
2. **PR it into `dev`.** Every push to `dev` redeploys staging at
   **dev.remappr.com** (`dev-deploy.yml`); nothing is released. Test it there.
   Branches pile up on `dev` until the batch is ready.
3. **Release: PR `dev` into `main`.** Promote the sibling repos the same way
   first (below). `main-guard.yml` fails any PR into `main` that does not come
   from `dev` (release-please's own PR aside), so a branch never ships by
   itself. A quick fix goes the same way: into `dev`, then `dev` → `main`.
4. **Merge with "Create a merge commit"**, never squash. release-please reads
   the individual conventional commits to pick the version and write the notes;
   a squash hands it a single commit (the PR title) instead.
5. **That's the release.** `release.yml` then, without further input:
    - opens the release-please PR and auto-merges it,
    - creates the GitHub release as a **draft**,
    - adds the sibling repos' changes to the notes and records the sibling
      commits it was built from (`scripts/release/`),
    - publishes it, which fires:
        - `build-release.yml`: Windows / macOS / Linux installers,
        - `main.yml`: remappr.com,
        - `docs.yml`: the docs' What's new page,
        - `discord-release.yml`: the announcement, with an `@everyone` ping,
    - brings `dev` level with `main` (job `sync-dev`): a PR `main` → `dev`
      holding the release commit (version bump, CHANGELOG), merged at once. If
      it conflicts, the PR stays open: merge it by hand.

A docs-only change follows the same path: `docs.yml` deploys it, and with no
`feat` / `fix` in it, no release is cut.

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
is at release time, so they follow the same flow: branch from `main`, PR into
`dev`, and PR their `dev` into `main` before the app's `dev` → `main`.
CI on the app's `dev` → `main` PR (`ci.yml`, `pr-preview.yml`) links the
siblings' `main`, so it fails when the app needs a sibling change that is
still waiting on that sibling's `dev`.

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

## App updates

The installers update in one of two ways (`src/main/updates.ts`):

- **AppImage, the Windows installer, and macOS builds signed with a
  Developer ID** update themselves. electron-updater finds the release through
  the `latest*.yml` files that `build-release.yml` uploads beside the
  installers. It downloads in the background, checks the sha512, and installs
  on restart (the app offers one) or at the next quit. Until a release's
  `latest*.yml` is uploaded, its check just fails quietly and tries again at
  the next start.
- **deb, rpm, pacman, tar.gz, the portable exe and ad-hoc macOS builds** only
  notify ("Download" opens the release). On Linux the package manager owns the
  first four.

## Builder releases

The builder ships on its own (plan §6c B). It is released from the
`remapprBuilder` repo, not with the app. Its `release.yml` publishes each
release to both Supabase projects through `publish-package` (stable from
`main`, beta from a manual run on `dev`), then sends `builder-released` here.
It follows the same flow as the app: `dev` → `main` is the release, with its
own `main-guard.yml` and `sync-dev` job. Its release-please PR is not
auto-merged: merge it to publish.
`main.yml` then redeploys remappr.com (stable only), and `dev-deploy.yml`
redeploys dev.remappr.com, so each site's builder seed is the new package.
Apps that are already open fetch it in the background, then announce it with
its notes. A builder that needs a newer app is announced instead ("needs a
newer Remappr").

Builds load the delivered builder only when the `REMAPPR_BUILDER` repo
variable is `package`. Unset, they bundle it as before. Set it once the first
stable package is published to production.

## Manual redeploys

- **remappr.com**: run `main.yml` by hand; it redeploys the latest release.
- **docs.remappr.com**: deploys on every docs change on `main` and on each
  release, or run `docs.yml` by hand.
- **dev.remappr.com**: run `dev-deploy.yml` by hand.
- **A builder release** (stable or beta): run the builder repo's `release.yml`
  by hand on `main` or `dev`. Re-publishing a version it already has does
  nothing.

## One-time setup

- Branch protection on `main` and `dev` in all four repos (`remappr`,
  `remapprClientFirmware`, `remapprBuilder`, `remapprUI`): a PR is required
  (no approvals), no force pushes, no deletions. Admins are not held to it,
  so the release workflow's `RELEASE_PAT` can still push the `Release-As`
  commit.
- The `github-pages` environment must allow **`v*` tags** as well as `main`:
  the site deploys from the release tag.
- `DISCORD_WEBHOOK_URL` in the `remappr` environment; the webhook needs
  _Mention @everyone, @here and All Roles_ in its channel, otherwise it posts
  without the ping.
- Builder repo (`Wolffyx/remapprBuilder`) → Settings → Secrets and variables
  → Actions: variable `PUBLISH_URLS` = the production and staging Supabase URLs
  (space-separated); secret `APP_DISPATCH_TOKEN` = a fine-grained token with
  _Contents: read and write_ on `Wolffyx/remappr`, so builder releases
  redeploy the sites.
- `REMAPPR_BUILDER` = `package` (repository variable here) switches public
  builds to the delivered builder (see [Builder releases](#builder-releases)).
