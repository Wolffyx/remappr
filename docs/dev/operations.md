# Operations

How the cloud side of Remappr is kept running: health checks, backups, the
restore drill, and what happens when someone deletes their account. Everything
here is optional for the app itself: with no Supabase project configured, the
app runs fully local.

## Environments

|                        | Staging                      | Production                          |
| ---------------------- | ---------------------------- | ----------------------------------- |
| Supabase project       | second free project          | `Remappr`, Frankfurt (eu-central-1) |
| Web                    | dev.remappr.com, PR previews | remappr.com, the installers         |
| Migrations + functions | on push to `dev`             | on a published release              |

Builds also need `VITE_REMAPPR_ENV` (`production` or `staging`); the
workflows set it. It picks the signing keys the build trusts, so a
production app never accepts a license signed by staging. On CI a missing
variable gives a build with no backend and no trusted keys.

Locally, `.env.local` holds all three backends and `REMAPPR_BACKEND` picks
one (dev by default); see `supabase/README.md` and `pnpm backend`.

GitHub settings:

| Where                                                                       | Name                                                                                                                                                                                                                 |
| --------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| environment `remappr`, variables                                            | `VITE_SUPABASE_URL_STAGING`, `VITE_SUPABASE_PUBLISHABLE_KEY_STAGING`, `VITE_SUPABASE_URL_PRODUCTION`, `VITE_SUPABASE_PUBLISHABLE_KEY_PRODUCTION`, `SIGNING_PUBLIC_KEYS_STAGING` (printed by `pnpm backend keys dev`) |
| environment `supabase-staging` (branch `dev`), secrets                      | `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_REF_STAGING`                                                                                                                                                              |
| environment `supabase-production` (tags `v*`, needs your approval), secrets | `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_REF_PRODUCTION`                                                                                                                                                           |

Deploys need no database password: the Supabase CLI signs in with the
access token. Use a dedicated token (Supabase dashboard → Account →
Access Tokens), not your personal CLI login.

Each Supabase project also needs its own signing keys. Make them with
`node scripts/gen-signing-keys.mjs <staging|production> <project-ref>`: it
sets them straight as the project's secrets and pins the public keys in the
app (see `supabase/README.md`). The private keys exist nowhere else.

Free projects pause after a week without activity and have no daily backups,
so production relies on the weekly backup below until it moves to a paid plan.

## Health checks

| Check                     | URL                                                 | Healthy                    |
| ------------------------- | --------------------------------------------------- | -------------------------- |
| Edge Functions + database | `https://<project>.supabase.co/functions/v1/health` | `200 {"ok":true,"dbMs":…}` |
| Auth                      | `https://<project>.supabase.co/auth/v1/health`      | `200`                      |

Point an uptime monitor at both, every 5 minutes, alerting after 2 failures.
`health` needs no key; it answers `503 {"ok":false}` when the database does
not, and logs the reason in the function's logs.

Also on in the Supabase dashboard:

- Usage emails and the spend cap.
- The Security and Performance Advisors, read before each production push.

Weekly, look at failed scheduled jobs:

```sql
select j.jobname, d.status, d.return_message, d.start_time
  from cron.job_run_details d join cron.job j using (jobid)
 where d.status <> 'succeeded' and d.start_time > now() - interval '7 days'
 order by d.start_time desc;
```

Also weekly, look for builder licenses being shared or forged: accounts that
activated or were refused many devices lately.

```sql
select user_id, kind, count(*) as times, max(at) as last
  from private.audit_log
 where kind in ('license_activated', 'license_refused', 'device_deactivated')
   and at > now() - interval '30 days'
 group by user_id, kind
having count(*) >= 4
 order by times desc;
```

## Backups

Supabase keeps daily backups (7 days on Pro). On top of that,
`.github/workflows/db-backup.yml` makes a weekly off-site copy:

1. `scripts/db/backup.sh` dumps roles, schema and data with the Supabase CLI,
   and records the exact row count of every table (`counts.tsv`).
2. The tarball is encrypted with [age](https://age-encryption.org) to
   `AGE_RECIPIENT` on the runner, so only the encrypted file leaves it.
3. It goes to an S3-compatible bucket (Cloudflare R2) under `db/`, and copies
   older than 90 days are deleted.

Storage _files_ (device photos, builder packages) are not in the dump, only
their rows. Builder packages can be published again from CI; device photos
rely on Supabase's own storage durability.

### Setup

In the repository, the environment `supabase-backups` (branch `main`, no approval, so the weekly run never waits) holds:

| Kind     | Name                                                     | Value                                          |
| -------- | -------------------------------------------------------- | ---------------------------------------------- |
| secret   | `SUPABASE_DB_URL`                                        | the project's session pooler connection string |
| secret   | `BACKUP_S3_ACCESS_KEY_ID`, `BACKUP_S3_SECRET_ACCESS_KEY` | an R2 token limited to the backup bucket       |
| secret   | `AGE_IDENTITY`                                           | the age private key (for the drill only)       |
| variable | `AGE_RECIPIENT`                                          | the matching age public key (`age1…`)          |
| variable | `BACKUP_S3_ENDPOINT`                                     | `https://<account>.r2.cloudflarestorage.com`   |
| variable | `BACKUP_S3_BUCKET`                                       | the bucket name                                |

Make the key pair with `age-keygen -o remappr-backup.key`. Keep a copy of the
private key offline as well: without it no backup can be read.

Until these are set, both workflows skip with a notice.

## Restore drill

`.github/workflows/db-restore-drill.yml` runs every quarter (and on demand from
the Actions tab). It downloads the newest backup, decrypts it, and runs
`scripts/db/restore-drill.sh`, which:

1. starts a throwaway Supabase stack on ports `5532x`,
2. restores roles, schema and data into it,
3. compares every table's row count with the backup's `counts.tsv`,

and fails on any restore error or mismatch. Run it locally against your dev
stack the same way:

```bash
scripts/db/backup.sh /tmp/remappr-backups
```

```bash
scripts/db/restore-drill.sh /tmp/remappr-backups/remappr-db-<stamp>.tar.gz
```

Your dev stack on `5432x` is not touched.

### Restoring production for real

1. Create a new Supabase project (or pause writes on the broken one).
2. Decrypt the backup: `age -d -i remappr-backup.key -o backup.tar.gz <file>.age`,
   then `tar -xzf backup.tar.gz`.
3. Restore, connected as the project's `postgres` user:

    ```bash
    psql "$NEW_DB_URL" -v ON_ERROR_STOP=1 --single-transaction -f roles.sql -f schema.sql -c 'set session_replication_role = replica' -f data.sql
    ```

    `postgres` is not a superuser on Supabase. If `roles.sql` stops at a
    `GRANT SET ON PARAMETER` line, delete that line and run it again: a new
    project already has those grants. (The drill connects as the local
    `supabase_admin` and does not hit this.)

4. Compare row counts with `scripts/db/counts.sql` against `counts.tsv`.
5. Deploy the Edge Functions and secrets, then point the app's
   `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY` at the new project.

## Admins

An account whose `app_metadata.role` is `admin` uses the builder without
paying: it counts as holding a permanent grant of the `staff` plan (the paid
plans' limits, 10 devices), works offline like a lifetime license, and also
opens the moderation queue (with two-factor sign-in). Only the service role or
the dashboard can set it, in the SQL editor:

```sql
update auth.users
   set raw_app_meta_data = raw_app_meta_data || '{"role": "admin"}'
 where email = 'you@example.com';
```

The admin signs out and in again (the role is read from a fresh session),
then activates the device in Settings → Account → Builder devices. Remove
the role with `raw_app_meta_data - 'role'`.

## Signing-key backups

Each project's signing keys (Edge Functions → Secrets) cannot be read back
from Supabase. `pnpm backend keys` writes an encrypted copy (scrypt +
AES-256-GCM, your passphrase) to `~/remappr-key-backups/` before setting
them. Keep that file in a password manager or on an offline drive, the
passphrase somewhere else, and check it now and then with
`pnpm backend keys-verify <file>`. Recovery: `pnpm backend keys-restore
<file> prod`. Without a backup, a lost key means a rotation (supabase/README.md).
They are not in the database backups.

## Account data requests

Users handle both themselves in **Settings → Account → Your data**:

- **Download my data** calls `export-account`, which returns one JSON document:
  account, profile, library items with every version, stars, comments,
  reports, purchases and builder devices. Billing details live in Stripe and
  are added to the export once Stripe is wired up.
- **Delete account** calls `delete-account` after the user types their email.
  It is refused while a subscription still bills. It clears the user's comment
  texts (the comments stay as "[deleted]"), removes their device photos, then
  deletes the auth user, which cascades to their profile, library, versions,
  stars, reports and builder devices. Purchases stay without a user, for tax
  records. Audit rows stay without a user.

A request by email instead: confirm it comes from the account's address, then
run the same function on their behalf, or `select public.account_export('<id>')`
as the service role.
