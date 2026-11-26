#!/usr/bin/env bash
# Run the local Supabase stack from a copy of supabase/ outside the repo.
#
#   scripts/db/local-stack.sh start|sync|stop [supabase args...]
#
# Why: the stack's containers come back with Docker at boot, and some of them
# bind-mount files from the CLI's workdir (Studio: functions and snippets;
# Kong: the email template). With the repo on a drive that is mounted after
# Docker starts, Docker creates the missing paths itself, owned by root, and
# the drive then mounts somewhere else (Work -> Work1). A workdir under $HOME
# is always there at boot.
#
# The copy lives in REMAPPR_STACK_DIR (default ~/Projects/Databases/remappr).
# The database itself is in Docker volumes keyed by project_id, so it survives
# moving the workdir. Edits to supabase/ reach the running stack on the next
# start or sync.
set -euo pipefail

here=$(cd "$(dirname "$0")" && pwd)
root=$(cd "$here/../.." && pwd)
# The repo's pinned CLI.
PATH="$root/node_modules/.bin:$PATH"
stack=${REMAPPR_STACK_DIR:-$HOME/Projects/Databases/remappr}

sync() {
    mkdir -p "$stack/supabase"
    # .temp and .branches link the repo to a hosted project (not needed
    # here); snippets are written by Studio into the copy, so keep them.
    rsync -a --delete \
        --exclude .temp --exclude .branches --exclude snippets \
        "$root/supabase/" "$stack/supabase/"
    echo "[remappr] local stack files: $stack/supabase"
}

cmd=${1:-start}
shift || true
case $cmd in
    sync) sync ;;
    start)
        sync
        supabase start --workdir "$stack" "$@"
        ;;
    stop)
        # The CLI reads project_id from the copy's config.toml.
        sync
        supabase stop --workdir "$stack" "$@"
        ;;
    *)
        echo "usage: local-stack.sh start|sync|stop [supabase args...]" >&2
        exit 2
        ;;
esac
