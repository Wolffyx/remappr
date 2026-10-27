# Supabase (Remappr cloud)

Schema, tests and config for the optional cloud backend. The app works without
it: with no `VITE_SUPABASE_*` env it is local-only.

## Local stack

Needs Docker. Everything runs on your machine; no hosted project or credentials.

```bash
pnpm db:start     # first run pulls images; prints URL + keys
pnpm db:reset     # re-apply migrations + seed.sql
pnpm db:test      # pgTAP tests in supabase/tests
pnpm db:lint      # schema lint
pnpm db:types     # regenerate src/renderer/src/lib/cloud/database.types.ts
pnpm db:stop
```

`pnpm db:new <name>` creates a migration. Migrations are forward-only.

## Run the app against it

`.env.local` in the repo root (gitignored) holds all three backends, and
`REMAPPR_BACKEND` picks one, **dev by default** (scripts/backend-env.ts):

```
REMAPPR_BACKEND=dev
DEV_SUPABASE_URL=https://avwxfpuayobtsgpyrwoz.supabase.co
DEV_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
PROD_SUPABASE_URL=https://ljzmmudynmlnaqraqbau.supabase.co
PROD_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
LOCAL_SUPABASE_URL=http://127.0.0.1:54321
LOCAL_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...   # printed by pnpm db:start
```

For one run against another backend: `REMAPPR_BACKEND=local pnpm dev` or
`REMAPPR_BACKEND=prod pnpm edev`. `pnpm backend` shows which one is active.
Restart `pnpm edev` / `pnpm dev` after changing it. Each backend's builds
trust only that environment's signing keys (`__REMAPPR_ENV__`).

`pnpm dev` and `pnpm edev` first bring the selected backend up to date,
forward only (`pnpm backend sync`): on dev they apply new migrations and
redeploy the Edge Functions when they changed; on local they apply new
migrations to the running stack. **Production is never changed this way**,
and nothing ever resets or rolls back (`pnpm db:reset` only touches the
local stack). Offline, it warns and starts anyway; `REMAPPR_SKIP_SYNC=1`
skips it.

Hosted projects: `pnpm backend push dev|prod` applies the migrations,
`pnpm backend deploy dev|prod` deploys the Edge Functions and
`pnpm backend keys dev|prod` creates the signing keys once; prod asks first.

Then `pnpm dev` (web) or `pnpm edev` (Electron). Settings → Account and the
header account button appear.

- **Email sign-in**: enter any address; the 6-digit code lands in Mailpit at
  <http://127.0.0.1:54324>.
- **GitHub / Discord / Google**: off locally until you make a dev OAuth app
  with callback `http://127.0.0.1:54321/auth/v1/callback`, put its id and
  secret in `supabase/.env` (`SUPABASE_AUTH_EXTERNAL_GITHUB_CLIENT_ID`, …),
  set `enabled = true` in `config.toml` and restart the stack.
- **Desktop OAuth** returns through `public/auth/desktop.html` on the dev
  server (`http://localhost:5173`), which opens `remappr://auth/callback`.
  Unpackaged `pnpm edev` may not own the `remappr://` scheme; paste the code the
  page shows instead.

Remove `.env.local` to get the local-only app back.

## Library sync integration test

`src/renderer/src/lib/library/cloudSync.integration.test.ts` drives the real
cloud library and sync engine against the local stack: two machines on one
account, a conflict, another account's isolation, the free-plan quota, a cloud
delete and a device backup. It creates and deletes its own users. It is skipped
unless these are set (values from `pnpm exec supabase status -o env`):

```bash
E2E_API_URL=http://127.0.0.1:54321 E2E_PUBLISHABLE_KEY=sb_publishable_… E2E_SERVICE_ROLE_KEY=eyJ… pnpm exec vitest run src/renderer/src/lib/library/cloudSync.integration.test.ts
```

If `pnpm db:start` leaves the API on :54321 unreachable, the gateway container
was left stopped from an earlier run: `pnpm db:stop && pnpm db:start` (data is
kept).

## Builder licenses (Edge Functions)

`license-activate` and `license-refresh` sign Ed25519 builder licenses.
Locally they read `supabase/functions/.env` (gitignored; a dev key pair whose
public half is pinned for dev builds only in
`src/renderer/src/lib/license/keys.ts`). Serve them with:

```bash
pnpm exec supabase functions serve --env-file supabase/functions/.env
```

Per environment, once (after `pnpm exec supabase login`):

1. `pnpm backend keys dev|prod` (scripts/gen-signing-keys.mjs) generates the
   license and package key pairs and the watermark key in memory and sets
   them as that project's secrets. The private keys are never written to
   disk or shown, and Supabase does not show them again: only the project can
   sign licenses. It refuses a project that already has keys.
2. The public halves:
    - **prod**: pinned in `src/renderer/src/lib/license/keys.ts` and
      `src/shared/builderPackage.ts`. Commit them and ship that release
      before the server's licenses reach users.
    - **dev**: not in the code. They go to `DEV_SIGNING_PUBLIC_KEYS` in
      `.env.local`, and the script prints the value for the GitHub variable
      `SIGNING_PUBLIC_KEYS_STAGING`. Only staging builds read them;
      production builds trust nothing but the pinned keys.

Lifetime licenses and permanent grants never expire: activated once, they
work offline for good, so their only protection against forgery is that the
private key never leaves the project. Subscriptions are 30-day leases
(`claimsFor` in `_shared/license.ts`) that the app renews online, and
`license-refresh` checks the database every time. Never unpin an old key id:
lifetime devices that stay offline keep tokens signed with it.

Rotating a key: pin the new public key in a release first, then set the new
private key and kid; keep the old public key pinned. Losing a project's
secrets means doing exactly that.

## Builder packages

`get-package` serves the builder: "free" while the free plan grants it,
otherwise only with a valid device license, watermarked per user and logged
(10 a day). Publish a built package to the local stack with:

```bash
pnpm builder:publish
```

(It builds nothing: run `pnpm build:package` in the builder repo first.) In a
dev build, localStorage `remappr.builder.source` = `delivered` makes the app
load the builder through get-package: verified, cached (Cache Storage + the
`/pkg-sw.js` service worker on the web, `remappr-pkg://` on desktop) and
available offline.

`src/renderer/src/lib/license/license.integration.test.ts` exercises the
functions end to end (needs them served plus the `E2E_*` variables above).

### Public builds without the bundled builder

Builds meant for users stop bundling the builder:

```bash
pnpm link:builder-package   # the builder folder becomes a stub
pnpm builder:seed           # free stage only: a signed seed for the first run
pnpm build                  # (or the electron build)
```

With the stub in place the app loads the builder through get-package
(licensed, verified, cached) and prefetches it in the background on start,
when the connection comes back and when the desktop app finds an update. The
seed lands in public/\_seed/builder.json; the web installs it on first use and
the desktop main process installs it into its package cache at start, so the
first run works without a download. Once the builder is paid, get-package
refuses anonymous calls and `builder:seed` removes the seed.

Production builds trust only `PRODUCTION_PACKAGE_KEYS`: a seed or package
signed with the local dev key is refused there (by design). `pnpm
link:builder-source` brings the bundled builder back for development.

The CI workflows still build with the bundled builder: switch them once
staging/production have signing keys and a published package (P11).
