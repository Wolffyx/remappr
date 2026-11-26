#!/usr/bin/env bash
# Dump a Supabase database (roles, schema, data) plus exact row counts into one
# tarball, encrypted with age when AGE_RECIPIENT is set.
#
#   scripts/db/backup.sh <out-dir> [db-url]
#
# Without a db-url it dumps the local stack (supabase start). Prints the path
# of the file it wrote. Storage *files* are not in it: only their rows.
set -euo pipefail

out=${1:?usage: backup.sh <out-dir> [db-url]}
url=${2:-}
here=$(cd "$(dirname "$0")" && pwd)
# The repo's pinned CLI when there is one (CI may put its own on PATH).
PATH="$here/../../node_modules/.bin:$PATH"
stamp=$(date -u +%Y%m%dT%H%M%SZ)
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT

if [[ -n $url ]]; then
    src=(--db-url "$url")
    psql_url=$url
else
    src=(--local)
    psql_url=postgresql://postgres:postgres@127.0.0.1:54322/postgres
fi

dir="$work/remappr-db-$stamp"
mkdir -p "$dir"
supabase db dump "${src[@]}" --role-only -f "$dir/roles.sql" >&2
supabase db dump "${src[@]}" -f "$dir/schema.sql" >&2
supabase db dump "${src[@]}" --data-only --use-copy -f "$dir/data.sql" >&2
psql "$psql_url" -X -q -At -F $'\t' -v ON_ERROR_STOP=1 -f "$here/counts.sql" >"$dir/counts.tsv"

mkdir -p "$out"
tarball="$out/remappr-db-$stamp.tar.gz"
tar -C "$work" -czf "$tarball" "remappr-db-$stamp"
if [[ -n ${AGE_RECIPIENT:-} ]]; then
    age -r "$AGE_RECIPIENT" -o "$tarball.age" "$tarball"
    rm "$tarball"
    tarball="$tarball.age"
fi
echo "$tarball"
