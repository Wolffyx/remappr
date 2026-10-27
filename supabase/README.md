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
