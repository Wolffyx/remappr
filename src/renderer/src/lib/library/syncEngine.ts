// Pattern check: Strategy (Tier 1) — applied — the conflict resolutions (keep
// mine / take cloud / keep both) are interchangeable strategies over the two
// Repositories; the engine is plain functions over the injected local and
// cloud libraries.
//
// Two-way sync between the local library (source of truth for editing) and the
// cloud. Push: create_item / save_item on top of the last seen head version; a
// refusal becomes the entry's state. Pull: the sync feed since a cursor; clean
// entries take the cloud's newer document, dirty ones become conflicts, cloud
// tombstones are handed back for the user to confirm.
import { createLogger } from '@shared/logger'
import {
    CloudLibraryError,
    type CloudLibrary,
    type CloudRefusal,
    type CloudRow,
} from './cloudLibrary'
import { cloudMetaOf, documentOf, entryFromSource } from './entries'
import type { LibraryRepository } from './localLibrary'
import type {
    LibraryDocKind,
    LibraryEntry,
    LibraryItemType,
    LibrarySync,
    NewLibraryEntry,
    LibrarySyncState,
} from './types'

const log = createLogger('LibrarySync')

export type ConflictChoice = 'mine' | 'cloud' | 'both'

export interface PullResult {
    /** The cursor for the next pull (the newest row's updated_at). */
    cursor: string | null
    /** Entries pulled or refreshed from the cloud. */
    pulled: number
    /** Local entries whose cloud item was deleted; the user decides. */
    tombstones: LibraryEntry[]
    /** Local entries that changed on both sides. */
    conflicts: LibraryEntry[]
}

export interface PushResult {
    /** Entries sent (whatever the outcome). */
    attempted: number
    /** Entries now in sync. */
    synced: number
}

export interface SyncEngine {
    /** Push one entry. Resolves the stored entry (with its new sync state). */
    push(localId: string): Promise<LibraryEntry | undefined>
    /** Push every entry that has unsent changes. Refused entries
     *  (over quota, needs the builder, in conflict) wait for retryRefused. */
    pushPending(): Promise<PushResult>
    /** Push the refused entries again (after an upgrade or a delete). */
    retryRefused(): Promise<PushResult>
    pull(cursor: string | null): Promise<PullResult>
    resolve(localId: string, choice: ConflictChoice): Promise<void>
    /** Keep a local copy whose cloud item went away; it stops syncing. */
    keepLocal(localId: string): Promise<void>
    /** Delete the entry's cloud item (the caller removes the local copy). */
    removeCloud(localId: string): Promise<void>
    /** The cloud head of a conflicted entry, parsed, for the conflict dialog. */
    cloudCopy(localId: string): Promise<NewLibraryEntry | null>
}

const PAGE = 500
const SYNCED_TYPES: ReadonlySet<string> = new Set<LibraryItemType>([
    'device',
    'config',
])
const REFUSED: ReadonlySet<LibrarySyncState> = new Set([
    'over_quota',
    'needs_builder',
])

const REFUSAL_STATE: Record<CloudRefusal, LibrarySyncState> = {
    version_conflict: 'conflict',
    quota_exceeded: 'over_quota',
    feature_required: 'needs_builder',
    // A device item turns read-only once the builder is no longer granted.
    forbidden: 'needs_builder',
    not_found: 'local',
}

function sourceOf(document: unknown): string {
    return JSON.stringify(document, null, 2)
}

export function createSyncEngine(
    local: LibraryRepository,
    cloud: CloudLibrary,
    accountId: string,
): SyncEngine {
    const mine = (e: LibraryEntry): boolean =>
        !e.sync.localOnly && (e.sync.accountId ?? accountId) === accountId

    const needsPush = (e: LibraryEntry): boolean =>
        mine(e) &&
        !REFUSED.has(e.sync.state) &&
        e.sync.state !== 'conflict' &&
        (!e.sync.itemId || e.sync.dirty)

    /** Write new sync fields onto the CURRENT stored entry, so an edit made
     *  while a request was in flight is kept (and stays dirty). */
    const settle = async (
        sent: LibraryEntry,
        sync: Partial<LibrarySync>,
    ): Promise<LibraryEntry | undefined> => {
        const current = await local.get(sent.localId)
        if (!current) return undefined
        const editedMeanwhile = current.updatedAt !== sent.updatedAt
        const next: LibraryEntry = {
            ...current,
            sync: {
                ...current.sync,
                ...sync,
                accountId,
                dirty: editedMeanwhile || (sync.dirty ?? current.sync.dirty),
            },
        }
        await local.put(next)
        return next
    }

    const upload = async (entry: LibraryEntry): Promise<number> => {
        const { meta, identifiers } = cloudMetaOf(entry)
        const document = documentOf(entry)
        if (entry.sync.itemId)
            return cloud.save(entry.sync.itemId, entry.sync.baseVersion ?? 1, {
                document,
                name: entry.name,
                meta,
                identifiers,
            })
        const itemId = await cloud.create(
            {
                clientId: entry.localId,
                type: entry.type,
                name: entry.name,
                meta,
                identifiers,
            },
            document,
        )
        entry.sync.itemId = itemId
        // create_item is idempotent on client_id: an earlier upload whose reply
        // was lost already made the item; a head past 1 means it moved on.
        const head = (await cloud.head(itemId)) ?? 1
        if (head > 1)
            throw new CloudLibraryError('version_conflict', 'version_conflict')
        return head
    }

    const push = async (localId: string): Promise<LibraryEntry | undefined> => {
        const entry = await local.get(localId)
        if (!entry || !mine(entry) || entry.sync.state === 'conflict')
            return entry
        try {
            const head = await upload(entry)
            return settle(entry, {
                itemId: entry.sync.itemId,
                baseVersion: head,
                dirty: false,
                state: 'synced',
                remoteVersion: undefined,
                lastSyncedAt: Date.now(),
            })
        } catch (e) {
            if (!(e instanceof CloudLibraryError) || !e.refusal) throw e
            const state = REFUSAL_STATE[e.refusal]
            if (e.refusal === 'not_found')
                return settle(entry, {
                    itemId: undefined,
                    baseVersion: undefined,
                    state,
                    dirty: false,
                })
            const remoteVersion =
                state === 'conflict' && entry.sync.itemId
                    ? ((await cloud.head(entry.sync.itemId)) ?? undefined)
                    : undefined
            return settle(entry, {
                itemId: entry.sync.itemId,
                state,
                remoteVersion,
            })
        }
    }

    const pushAll = async (
        pick: (e: LibraryEntry) => boolean,
    ): Promise<PushResult> => {
        const entries = (await local.list()).filter(pick)
        let synced = 0
        for (const e of entries) {
            const after = await push(e.localId)
            if (after?.sync.state === 'synced') synced++
        }
        return { attempted: entries.length, synced }
    }

    const pullRows = async (cursor: string | null): Promise<CloudRow[]> => {
        const rows: CloudRow[] = []
        let since = cursor
        for (;;) {
            const page = await cloud.pull(since)
            rows.push(...page)
            if (page.length < PAGE) return rows
            since = page[page.length - 1].updatedAt
        }
    }

    /** Store each cloud document as a local entry (new or refreshed). */
    const download = async (
        rows: readonly { row: CloudRow; local?: LibraryEntry }[],
    ): Promise<number> => {
        if (rows.length === 0) return 0
        const docs = await cloud.fetch(
            rows.map(({ row }) => ({
                itemId: row.id,
                version: row.headVersion,
            })),
        )
        const byItem = new Map(docs.map((d) => [d.itemId, d]))
        let stored = 0
        for (const { row, local: existing } of rows) {
            const doc = byItem.get(row.id)
            const kind = (doc?.document as { kind?: string } | undefined)
                ?.kind as LibraryDocKind | undefined
            if (!doc || !kind) continue
            const extra = doc.meta.extra as Record<string, unknown> | undefined
            try {
                const fresh = entryFromSource(
                    kind,
                    sourceOf(doc.document),
                    row.type as LibraryItemType,
                    extra,
                )
                const now = Date.now()
                await local.put({
                    ...fresh,
                    name: row.name,
                    localId:
                        existing?.localId ??
                        row.clientId ??
                        crypto.randomUUID(),
                    createdAt: existing?.createdAt ?? now,
                    updatedAt: now,
                    sync: {
                        accountId,
                        itemId: row.id,
                        baseVersion: row.headVersion,
                        dirty: false,
                        state: 'synced',
                        lastSyncedAt: now,
                    },
                })
                stored++
            } catch (e) {
                log.error(
                    `cloud item ${row.id} did not parse; left in the cloud`,
                    e,
                )
            }
        }
        return stored
    }

    const pull = async (cursor: string | null): Promise<PullResult> => {
        const rows = (await pullRows(cursor)).filter((r) =>
            SYNCED_TYPES.has(r.type),
        )
        const entries = await local.list()
        const byItem = new Map(
            entries.filter((e) => e.sync.itemId).map((e) => [e.sync.itemId, e]),
        )
        const byLocal = new Map(entries.map((e) => [e.localId, e]))
        const toDownload: { row: CloudRow; local?: LibraryEntry }[] = []
        const tombstones: LibraryEntry[] = []
        const conflicts: LibraryEntry[] = []

        for (const row of rows) {
            const existing =
                byItem.get(row.id) ??
                (row.clientId ? byLocal.get(row.clientId) : undefined)
            if (existing && !mine(existing)) continue
            if (row.deletedAt) {
                if (existing?.sync.itemId === row.id) tombstones.push(existing)
                continue
            }
            if (!existing) {
                toDownload.push({ row })
                continue
            }
            if ((existing.sync.baseVersion ?? 0) >= row.headVersion) continue
            if (!existing.sync.dirty && existing.sync.state !== 'conflict') {
                toDownload.push({ row, local: existing })
                continue
            }
            const conflicted: LibraryEntry = {
                ...existing,
                sync: {
                    ...existing.sync,
                    itemId: row.id,
                    state: 'conflict',
                    remoteVersion: row.headVersion,
                },
            }
            await local.put(conflicted)
            conflicts.push(conflicted)
        }

        const pulled = await download(toDownload)
        return {
            cursor: rows.length ? rows[rows.length - 1].updatedAt : cursor,
            pulled,
            tombstones,
            conflicts,
        }
    }

    const takeCloud = async (entry: LibraryEntry): Promise<void> => {
        const itemId = entry.sync.itemId
        if (!itemId) return
        const head = await cloud.head(itemId)
        if (head === null) return
        const row: CloudRow = {
            id: itemId,
            clientId: entry.localId,
            type: entry.type,
            name: entry.name,
            headVersion: head,
            updatedAt: new Date().toISOString(),
            deletedAt: null,
        }
        await download([{ row, local: entry }])
    }

    const RESOLVE: Record<
        ConflictChoice,
        (entry: LibraryEntry) => Promise<void>
    > = {
        cloud: takeCloud,
        mine: async (entry) => {
            const head = entry.sync.itemId
                ? await cloud.head(entry.sync.itemId)
                : null
            await local.put({
                ...entry,
                sync: {
                    ...entry.sync,
                    baseVersion: head ?? entry.sync.baseVersion,
                    state: 'pending',
                    dirty: true,
                },
            })
            await push(entry.localId)
        },
        both: async (entry) => {
            const now = Date.now()
            await local.put({
                ...entry,
                localId: crypto.randomUUID(),
                name: `${entry.name} (this device)`,
                createdAt: now,
                updatedAt: now,
                sync: { dirty: false, state: 'local' },
            })
            await takeCloud(entry)
        },
    }

    return {
        push,
        pushPending: () => pushAll(needsPush),
        retryRefused: () =>
            pushAll((e) => mine(e) && REFUSED.has(e.sync.state)),
        pull,
        async resolve(localId, choice) {
            const entry = await local.get(localId)
            if (entry) await RESOLVE[choice](entry)
        },
        async keepLocal(localId) {
            const entry = await local.get(localId)
            if (!entry) return
            await local.put({
                ...entry,
                sync: { dirty: false, state: 'local', localOnly: true },
            })
        },
        async removeCloud(localId) {
            const itemId = (await local.get(localId))?.sync.itemId
            if (itemId) await cloud.remove(itemId)
        },
        async cloudCopy(localId) {
            const entry = await local.get(localId)
            const itemId = entry?.sync.itemId
            const head = itemId ? await cloud.head(itemId) : null
            if (!entry || !itemId || head === null) return null
            const [doc] = await cloud.fetch([{ itemId, version: head }])
            const kind = (doc?.document as { kind?: string } | undefined)
                ?.kind as LibraryDocKind | undefined
            if (!doc || !kind) return null
            return entryFromSource(
                kind,
                sourceOf(doc.document),
                entry.type,
                doc.meta.extra as Record<string, unknown> | undefined,
            )
        },
    }
}
