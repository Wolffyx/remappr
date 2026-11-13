// Pattern check: no GoF pattern (-) — rejected — record/prune rules over the
// injected VersionRepository; one caller (stores/historyStore).
//
// What a version is (plan §6c A):
// - autosave: the document a short while after edits stop; only the newest
//   AUTOSAVES_KEPT are kept.
// - checkpoint: "Save version" with a message (like a commit); always kept.
//   Saving a checkpoint of a document that is already the newest autosave
//   turns that autosave into the checkpoint instead of copying it.
// - github: pulled from a linked repo (P10f); always kept.
// Restoring never rewrites history: it records a new checkpoint.
import type {
    LocalVersion,
    VersionKind,
    VersionRepository,
} from './versionRepo'

export const AUTOSAVES_KEPT = 50

export interface Snapshot {
    localId: string
    name: string
    source: string
}

const sameDocument = (v: LocalVersion, s: Snapshot): boolean =>
    v.source === s.source && v.name === s.name

/** Drop the oldest autosaves beyond AUTOSAVES_KEPT. */
async function prune(
    repo: VersionRepository,
    versions: readonly LocalVersion[],
): Promise<void> {
    const autosaves = versions.filter((v) => v.kind === 'autosave')
    const excess = autosaves.length - AUTOSAVES_KEPT
    for (const v of autosaves.slice(0, Math.max(0, excess)))
        await repo.remove(v.localId, v.n)
}

/** A newest version that already holds this document: an autosave becomes
 *  the checkpoint; anything else stays as it is (a message is updated). */
async function reuse(
    repo: VersionRepository,
    last: LocalVersion,
    kind: VersionKind,
    message: string,
): Promise<LocalVersion> {
    if (kind === 'autosave') return last
    const keepKind = last.kind === 'autosave' ? kind : last.kind
    const next = { ...last, kind: keepKind, message: message || last.message }
    if (next.kind !== last.kind || next.message !== last.message)
        await repo.put(next)
    return next
}

export interface RecordOptions {
    kind: VersionKind
    message?: string
    now?: number
}

/** Record the snapshot as a version unless the newest one already holds it. */
export async function recordVersion(
    repo: VersionRepository,
    snapshot: Snapshot,
    { kind, message = '', now = Date.now() }: RecordOptions,
): Promise<LocalVersion> {
    const versions = await repo.list(snapshot.localId)
    const last = versions.at(-1)
    if (last && sameDocument(last, snapshot))
        return reuse(repo, last, kind, message)
    const version: LocalVersion = {
        ...snapshot,
        n: (last?.n ?? 0) + 1,
        kind,
        message,
        createdAt: now,
    }
    await repo.put(version)
    if (kind === 'autosave') await prune(repo, [...versions, version])
    return version
}

/** What the sync engine needs from local history (it defines no storage of
 *  its own): the checkpoints a synced entry has not sent yet, and a way to
 *  record which cloud version each became. */
export interface CheckpointSource {
    /** Entries with checkpoints still to send (one pass over all history). */
    pendingIds(): Promise<Set<string>>
    /** An entry's unsent checkpoints, oldest first. */
    pending(localId: string): Promise<LocalVersion[]>
    /** Version n became cloud version `cloudVersion` (0: stays local). */
    mark(localId: string, n: number, cloudVersion: number): Promise<void>
}

// Kept versions reach the cloud: checkpoints and ones pulled from GitHub.
const unsent = (v: LocalVersion): boolean =>
    v.kind !== 'autosave' && v.cloudVersion === undefined

// Pattern check: Adapter (Tier 1) — applied — the VersionRepository behind the
// sync engine's narrow CheckpointSource.
export function checkpointSource(repo: VersionRepository): CheckpointSource {
    return {
        async pendingIds() {
            const all = await repo.listAll()
            return new Set(all.filter(unsent).map((v) => v.localId))
        },
        async pending(localId) {
            return (await repo.list(localId)).filter(unsent)
        },
        async mark(localId, n, cloudVersion) {
            const v = (await repo.list(localId)).find((x) => x.n === n)
            if (v) await repo.put({ ...v, cloudVersion })
        },
    }
}
