// pattern-check: skip — reads a release body's lock line into env assignments
//
// Pins the sibling repos to the commits a release recorded:
//   RELEASE_BODY="…" node scripts/release/lock-env.ts >> "$GITHUB_ENV"
// prints `REMAPPR_<NAME>_REF=<sha>` per locked sibling, which
// scripts/link-remappr.cjs then fetches. A release without a lock prints
// nothing, and the build uses each sibling's default branch.
import { readLock } from './notes.ts'

const lock = readLock(process.env.RELEASE_BODY) ?? {}
for (const [name, sha] of Object.entries(lock)) {
    if (/^[0-9a-f]{40}$/.test(sha ?? '')) {
        console.log(`REMAPPR_${name.toUpperCase()}_REF=${sha}`)
    }
}
