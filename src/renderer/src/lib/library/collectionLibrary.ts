// Pattern check: Repository (Tier 0) — applied — a user's collections behind
// list / create / add / remove / members, over create_item / save_item and
// collection_members.
//
// A collection is a cloud item of type `collection` whose document lists other
// items: `{kind: 'remappr.collection', items: [{id, note}]}`. Collections live
// only in the cloud (no local copy). Members are read through
// collection_members, so a member the viewer cannot see simply is not there.
import type { CloudClient } from '@/lib/cloud/client'
import type { Json } from '@/lib/cloud/database.types'

export interface CollectionMemberRef {
    id: string
    note: string
}

export interface CollectionDocument {
    kind: 'remappr.collection'
    items: CollectionMemberRef[]
}

export interface Collection {
    id: string
    name: string
    visibility: string
    headVersion: number
    items: CollectionMemberRef[]
}

export interface CollectionMember {
    itemId: string
    note: string
    name: string
    type: string
    owner: string | null
}

export interface CollectionLibrary {
    /** The signed-in user's collections, newest first. */
    mine(): Promise<Collection[]>
    create(name: string): Promise<string>
    add(collection: Collection, itemId: string, note: string): Promise<void>
    remove(collection: Collection, itemId: string): Promise<void>
    members(collectionId: string): Promise<CollectionMember[]>
}

/** The server caps a collection at 200 items. */
export const COLLECTION_MAX_ITEMS = 200

interface ErrorLike {
    message?: string
}

function unwrap<T>(res: { data: T | null; error: ErrorLike | null }): T {
    if (res.error) throw res.error
    return res.data as T
}

function documentOf(items: CollectionMemberRef[]): CollectionDocument {
    return { kind: 'remappr.collection', items }
}

/** A collection's members the viewer can see (signed in or not). */
export async function readCollectionMembers(
    client: CloudClient,
    collectionId: string,
): Promise<CollectionMember[]> {
    const rows = unwrap(
        await client.rpc('collection_members', { p_collection: collectionId }),
    )
    return rows.map((r) => ({
        itemId: r.item_id,
        note: r.note ?? '',
        name: r.name,
        type: r.type,
        owner: r.owner_username,
    }))
}

export function createCollectionLibrary(
    client: CloudClient,
    ownerId: string,
): CollectionLibrary {
    const save = async (
        c: Collection,
        items: CollectionMemberRef[],
    ): Promise<void> => {
        unwrap(
            await client.rpc('save_item', {
                p_item: c.id,
                p_base_version: c.headVersion,
                p_changes: { document: documentOf(items) } as unknown as Json,
            }),
        )
    }

    return {
        async mine() {
            const rows = unwrap(
                await client
                    .from('library_items')
                    .select('id, name, visibility, head_version')
                    .eq('owner_id', ownerId)
                    .eq('type', 'collection')
                    .is('deleted_at', null)
                    .order('updated_at', { ascending: false }),
            )
            if (rows.length === 0) return []
            const heads = rows
                .map(
                    (r) =>
                        `and(item_id.eq.${r.id},version.eq.${r.head_version})`,
                )
                .join(',')
            const docs = unwrap(
                await client
                    .from('library_item_versions')
                    .select('item_id, document')
                    .or(heads),
            )
            const byItem = new Map(
                docs.map((d) => [
                    d.item_id,
                    d.document as unknown as CollectionDocument,
                ]),
            )
            return rows.map((r) => ({
                id: r.id,
                name: r.name,
                visibility: r.visibility,
                headVersion: r.head_version,
                items: byItem.get(r.id)?.items ?? [],
            }))
        },
        async create(name) {
            return unwrap(
                await client.rpc('create_item', {
                    p_item: { type: 'collection', name } as Json,
                    p_document: documentOf([]) as unknown as Json,
                }),
            )
        },
        async add(collection, itemId, note) {
            if (collection.items.some((m) => m.id === itemId)) return
            await save(collection, [...collection.items, { id: itemId, note }])
        },
        async remove(collection, itemId) {
            await save(
                collection,
                collection.items.filter((m) => m.id !== itemId),
            )
        },
        members: (collectionId) => readCollectionMembers(client, collectionId),
    }
}
