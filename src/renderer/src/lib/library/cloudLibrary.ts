// Pattern check: Repository (Tier 0) — applied — hides the library RPCs and
// tables behind create/save/remove/pull/fetch so the sync engine works against
// one contract (and a fake in tests).
//
// The cloud side of the library: one row per item in `library_items`, its
// documents in `library_item_versions`. Writes go through the RPCs only; the
// server checks ownership, quotas and the builder gate.
import type { CloudClient } from '@/lib/cloud/client'
import type { Json } from '@/lib/cloud/database.types'
import type { LibraryItemType } from './types'

/** What the server refused, as a code the sync engine maps to a state. */
export type CloudRefusal =
    | 'version_conflict'
    | 'quota_exceeded'
    | 'feature_required'
    | 'forbidden'
    | 'not_found'

export class CloudLibraryError extends Error {
    constructor(
        readonly refusal: CloudRefusal | null,
        message: string,
        readonly hint?: string,
    ) {
        super(message)
        this.name = 'CloudLibraryError'
    }
}

export interface CloudItemInput {
    clientId: string
    type: LibraryItemType
    name: string
    meta: Record<string, unknown>
    identifiers: string[]
}

export interface CloudChanges {
    document?: unknown
    name?: string
    meta?: Record<string, unknown>
    identifiers?: string[]
}

/** One row of the sync feed. */
export interface CloudRow {
    id: string
    clientId: string | null
    type: string
    name: string
    headVersion: number
    updatedAt: string
    deletedAt: string | null
}

export interface CloudDocument {
    itemId: string
    version: number
    document: unknown
    meta: Record<string, unknown>
}

export interface CloudLibrary {
    /** Create an item (idempotent on clientId); resolves its id. */
    create(item: CloudItemInput, document: unknown): Promise<string>
    /** Save changes on top of `baseVersion`; resolves the new head version. */
    save(
        itemId: string,
        baseVersion: number,
        changes: CloudChanges,
    ): Promise<number>
    remove(itemId: string): Promise<void>
    /** Items changed after `since` (ISO), oldest first, at most 500. */
    pull(since: string | null): Promise<CloudRow[]>
    /** The documents at the given versions, in one round trip. */
    fetch(
        heads: readonly { itemId: string; version: number }[],
    ): Promise<CloudDocument[]>
    /** The item's current head version, or null when it is gone. */
    head(itemId: string): Promise<number | null>
    /** The item's sync-feed row, or null when it is gone. */
    row(itemId: string): Promise<CloudRow | null>
}

const REFUSALS: readonly CloudRefusal[] = [
    'version_conflict',
    'quota_exceeded',
    'feature_required',
    'forbidden',
    'not_found',
]

interface PostgrestErrorLike {
    message?: string
    hint?: string | null
}

function toError(e: PostgrestErrorLike): CloudLibraryError {
    const message = e.message ?? 'cloud request failed'
    const refusal = REFUSALS.find((r) => message === r) ?? null
    return new CloudLibraryError(refusal, message, e.hint ?? undefined)
}

function unwrap<T>(res: {
    data: T | null
    error: PostgrestErrorLike | null
}): T {
    if (res.error) throw toError(res.error)
    return res.data as T
}

/** PostgREST caps a URL; fetch heads in chunks of this many. */
const FETCH_CHUNK = 40

export function createCloudLibrary(client: CloudClient): CloudLibrary {
    const fetchChunk = async (
        heads: readonly { itemId: string; version: number }[],
    ): Promise<CloudDocument[]> => {
        const filter = heads
            .map((h) => `and(item_id.eq.${h.itemId},version.eq.${h.version})`)
            .join(',')
        const rows = unwrap(
            await client
                .from('library_item_versions')
                .select('item_id, version, document, library_items(meta)')
                .or(filter),
        )
        return rows.map((r) => ({
            itemId: r.item_id,
            version: r.version,
            document: r.document,
            meta: ((r.library_items as { meta?: unknown } | null)?.meta ??
                {}) as Record<string, unknown>,
        }))
    }

    return {
        async create(item, document) {
            return unwrap(
                await client.rpc('create_item', {
                    p_item: {
                        client_id: item.clientId,
                        type: item.type,
                        name: item.name,
                        meta: item.meta,
                        identifiers: item.identifiers,
                    } as Json,
                    p_document: document as Json,
                }),
            )
        },
        async save(itemId, baseVersion, changes) {
            return unwrap(
                await client.rpc('save_item', {
                    p_item: itemId,
                    p_base_version: baseVersion,
                    p_changes: changes as Json,
                }),
            )
        },
        async remove(itemId) {
            unwrap(await client.rpc('delete_item', { p_item: itemId }))
        },
        async pull(since) {
            // A null `since` reads everything; the RPC coalesces it.
            const rows = unwrap(
                await client.rpc('sync_pull', { p_since: since as string }),
            )
            return rows.map((r) => ({
                id: r.id,
                clientId: r.client_id,
                type: r.type,
                name: r.name,
                headVersion: r.head_version,
                updatedAt: r.updated_at,
                deletedAt: r.deleted_at,
            }))
        },
        async fetch(heads) {
            const out: CloudDocument[] = []
            for (let i = 0; i < heads.length; i += FETCH_CHUNK)
                out.push(...(await fetchChunk(heads.slice(i, i + FETCH_CHUNK))))
            return out
        },
        async head(itemId) {
            const { data, error } = await client
                .from('library_items')
                .select('head_version, deleted_at')
                .eq('id', itemId)
                .maybeSingle()
            if (error) throw toError(error)
            return data && !data.deleted_at ? data.head_version : null
        },
        async row(itemId) {
            const { data, error } = await client
                .from('library_items')
                .select(
                    'id, client_id, type, name, head_version, updated_at, deleted_at',
                )
                .eq('id', itemId)
                .maybeSingle()
            if (error) throw toError(error)
            if (!data || data.deleted_at) return null
            return {
                id: data.id,
                clientId: data.client_id,
                type: data.type,
                name: data.name,
                headVersion: data.head_version,
                updatedAt: data.updated_at,
                deletedAt: data.deleted_at,
            }
        },
    }
}
