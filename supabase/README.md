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

Create `.env.local` in the repo root (gitignored), using the values
`pnpm db:start` printed:

```
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

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

Per environment, once:

1. Generate an Ed25519 key pair and a 32-byte watermark key.
2. `supabase secrets set LICENSE_SIGNING_KEY=<hex> LICENSE_SIGNING_KID=lic-<env>-1 PACKAGE_SIGNING_KEY=<hex> PACKAGE_SIGNING_KID=pkg-<env>-1 WATERMARK_KEY=<hex>`
3. Add the license public key under its kid to `PRODUCTION_KEYS` in
   `src/renderer/src/lib/license/keys.ts` and the package public key to
   `PRODUCTION_PACKAGE_KEYS` in `src/shared/builderPackage.ts`, and ship that
   release before the server signs with them.

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
