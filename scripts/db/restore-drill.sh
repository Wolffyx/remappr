#!/usr/bin/env bash
# Restore drill: bring a backup up in a throwaway Supabase stack on its own
# ports (5532x, so the dev stack on 5432x is untouched) and check that every
# table has the row count the backup recorded.
#
#   scripts/db/restore-drill.sh <backup.tar.gz | backup.tar.gz.age> [age-identity]
#
# Exits non-zero on any restore error or count mismatch. Leaves nothing behind.
set -euo pipefail

backup=${1:?usage: restore-drill.sh <backup> [age-identity]}
identity=${2:-}
here=$(cd "$(dirname "$0")" && pwd)
PATH="$here/../../node_modules/.bin:$PATH"
work=$(mktemp -d)
project="$work/project"
# supabase_admin: roles.sql grants parameters, which needs a superuser.
db=postgresql://supabase_admin:postgres@127.0.0.1:55322/postgres

cleanup() {
    (cd "$project" 2>/dev/null && supabase stop --no-backup >/dev/null 2>&1) || true
    rm -rf "$work"
}
trap cleanup EXIT

tarball=$backup
if [[ $backup == *.age ]]; then
    [[ -n $identity ]] || { echo "an .age backup needs the identity file" >&2; exit 2; }
    tarball="$work/backup.tar.gz"
    age -d -i "$identity" -o "$tarball" "$backup"
fi
tar -C "$work" -xzf "$tarball"
dump=$(find "$work" -maxdepth 1 -type d -name 'remappr-db-*' | head -1)
[[ -n $dump ]] || { echo "no remappr-db-* folder in the backup" >&2; exit 2; }

# A bare project: only Postgres plus the services whose own migrations create
# the auth and storage tables the data restores into.
mkdir -p "$project"
(cd "$project" && supabase init --force >/dev/null)
sed -i -E 's/^project_id = .*/project_id = "remappr-drill"/; s/= 543([0-9]{2})$/= 553\1/' \
    "$project/supabase/config.toml"
(cd "$project" && supabase start \
    -x realtime,imgproxy,mailpit,postgres-meta,studio,edge-runtime,logflare,vector,supavisor >/dev/null)

psql "$db" -X -q -o /dev/null -v ON_ERROR_STOP=1 --single-transaction \
    -f "$dump/roles.sql" \
    -f "$dump/schema.sql" \
    -c 'set session_replication_role = replica' \
    -f "$dump/data.sql"

psql "$db" -X -q -At -F $'\t' -v ON_ERROR_STOP=1 -f "$here/counts.sql" >"$work/restored.tsv"
if diff -u "$dump/counts.tsv" "$work/restored.tsv"; then
    echo "restore drill passed: $(wc -l <"$dump/counts.tsv") tables match"
else
    echo "restore drill FAILED: row counts differ (above)" >&2
    exit 1
fi
