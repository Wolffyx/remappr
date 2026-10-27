// Pattern check: Repository (Tier 0) — applied — hides the community RPCs,
// release reads and the image upload behind one contract the UI calls.
//
// The shared side of the library: publishing a cloud item as a release
// (unlisted or public), share links, search, device matching, forks and
// download counts. Reads go through RLS (others only ever see releases); every
// write is an RPC the server checks.
import type { CloudClient } from '@/lib/cloud/client'
import type { Json } from '@/lib/cloud/database.types'

export type Visibility = 'unlisted' | 'public'
export type License = 'CC0-1.0' | 'CC-BY-4.0' | 'CC-BY-SA-4.0' | 'MIT'
export type SearchSort = 'new' | 'stars' | 'downloads'

export const LICENSES: readonly { id: License; label: string }[] = [
    { id: 'CC-BY-4.0', label: 'CC BY 4.0 — credit the author' },
    { id: 'CC-BY-SA-4.0', label: 'CC BY-SA 4.0 — credit, share alike' },
    { id: 'CC0-1.0', label: 'CC0 — public domain' },
    { id: 'MIT', label: 'MIT' },
]

export interface SearchFilters {
    type?: 'device' | 'config'
    device_kind?: string
    target?: string
    device_id?: string
    tag?: string
}

export interface CommunityHit {
    id: string
    type: string
    name: string
    summary: string
    tags: string[]
    license: string | null
    owner: string | null
    publishedAt: string | null
    stars: number
    downloads: number
    deviceKind: string | null
    target: string | null
}

export interface Release {
    releaseNo: number
    version: number
    changelog: string
    license: string | null
    createdAt: string
    document: unknown
}

export interface CommunityItem {
    id: string
    type: string
    name: string
    summary: string
    description: string
    license: string | null
    owner: string | null
    meta: Record<string, unknown>
    imageUrl: string | null
    forkedFrom: string | null
    downloads: number
    forks: number
    releases: Release[]
}

export interface SharedItem {
    id: string
    type: string
    name: string
    summary: string
    license: string | null
    owner: string | null
    releaseNo: number
    document: unknown
}

/** The owner's view of where an item stands. */
export interface PublishStatus {
    visibility: 'private' | Visibility
    license: License | null
    headVersion: number
    /** The version the latest release stamped; null before the first. */
    publishedVersion: number | null
}

export interface CommunityLibrary {
    status(itemId: string): Promise<PublishStatus | null>
    publish(
        itemId: string,
        visibility: Visibility,
        license: License,
        changelog: string,
    ): Promise<number>
    unpublish(itemId: string): Promise<void>
    shareToken(itemId: string): Promise<string | null>
    rotateShareToken(itemId: string): Promise<string>
    shared(token: string): Promise<SharedItem | null>
    search(
        query: string,
        filters: SearchFilters,
        sort: SearchSort,
        page: number,
    ): Promise<CommunityHit[]>
    /** Device items matching these identifiers, best first. */
    match(
        identifiers: readonly string[],
    ): Promise<{ deviceId: string; score: number }[]>
    item(itemId: string): Promise<CommunityItem | null>
    /** Copy a release into the caller's cloud library; resolves the new id. */
    fork(itemId: string, token?: string): Promise<string>
    recordDownload(itemId: string): Promise<void>
    /** Upload a device image; resolves its storage path for meta.image_path. */
    uploadImage(
        ownerId: string,
        itemId: string,
        file: Blob,
        fileName: string,
    ): Promise<string>
}

const IMAGE_BUCKET = 'device-images'

interface ErrorLike {
    message?: string
}

function unwrap<T>(res: { data: T | null; error: ErrorLike | null }): T {
    if (res.error) throw res.error
    return res.data as T
}

export function createCommunityLibrary(client: CloudClient): CommunityLibrary {
    const imageUrl = (path: unknown): string | null =>
        typeof path === 'string' && path
            ? client.storage.from(IMAGE_BUCKET).getPublicUrl(path).data
                  .publicUrl
            : null

    return {
        async status(itemId) {
            const { data, error } = await client
                .from('library_items')
                .select('visibility, license, head_version, published_version')
                .eq('id', itemId)
                .maybeSingle()
            if (error) throw error
            if (!data) return null
            return {
                visibility: data.visibility as PublishStatus['visibility'],
                license: data.license as License | null,
                headVersion: data.head_version,
                publishedVersion: data.published_version,
            }
        },
        async publish(itemId, visibility, license, changelog) {
            return unwrap(
                await client.rpc('publish_item', {
                    p_item: itemId,
                    p_visibility: visibility,
                    p_license: license,
                    p_changelog: changelog,
                }),
            )
        },
        async unpublish(itemId) {
            unwrap(await client.rpc('unpublish_item', { p_item: itemId }))
        },
        async shareToken(itemId) {
            return (
                unwrap(
                    await client.rpc('get_share_token', { p_item: itemId }),
                ) || null
            )
        },
        async rotateShareToken(itemId) {
            return unwrap(
                await client.rpc('rotate_share_token', { p_item: itemId }),
            )
        },
        async shared(token) {
            const rows = unwrap(
                await client.rpc('get_shared_item', { p_token: token }),
            )
            const r = rows[0]
            if (!r) return null
            return {
                id: r.id,
                type: r.type,
                name: r.name,
                summary: r.summary,
                license: r.license,
                owner: r.owner_username,
                releaseNo: r.release_no,
                document: r.document,
            }
        },
        async search(query, filters, sort, page) {
            const rows = unwrap(
                await client.rpc('search_items', {
                    p_query: query,
                    p_filters: filters as Json,
                    p_sort: sort,
                    p_page: page,
                }),
            )
            return rows.map((r) => ({
                id: r.id,
                type: r.type,
                name: r.name,
                summary: r.summary,
                tags: r.tags ?? [],
                license: r.license,
                owner: r.owner_username,
                publishedAt: r.published_at,
                stars: r.stars,
                downloads: r.downloads,
                deviceKind: r.device_kind,
                target: r.target,
            }))
        },
        async match(identifiers) {
            if (identifiers.length === 0) return []
            const rows = unwrap(
                await client.rpc('match_devices', {
                    p_identifiers: [...identifiers] as Json,
                }),
            )
            return rows.map((r) => ({ deviceId: r.device_id, score: r.score }))
        },
        async item(itemId) {
            const { data: row, error } = await client
                .from('library_items')
                .select(
                    'id, type, name, summary, description, license, meta, forked_from, downloads_count, forks_count, users(username)',
                )
                .eq('id', itemId)
                .maybeSingle()
            if (error) throw error
            if (!row) return null
            const versions = unwrap(
                await client
                    .from('library_item_versions')
                    .select(
                        'release_no, version, changelog, license, created_at, document',
                    )
                    .eq('item_id', itemId)
                    .not('release_no', 'is', null)
                    .order('release_no', { ascending: false }),
            )
            const meta = (row.meta ?? {}) as Record<string, unknown>
            return {
                id: row.id,
                type: row.type,
                name: row.name,
                summary: row.summary,
                description: row.description,
                license: row.license,
                owner:
                    (row.users as { username?: string | null } | null)
                        ?.username ?? null,
                meta,
                imageUrl: imageUrl(meta.image_path),
                forkedFrom: row.forked_from,
                downloads: row.downloads_count,
                forks: row.forks_count,
                releases: versions.map((v) => ({
                    releaseNo: v.release_no as number,
                    version: v.version,
                    changelog: v.changelog,
                    license: v.license,
                    createdAt: v.created_at,
                    document: v.document,
                })),
            }
        },
        async fork(itemId, token) {
            return unwrap(
                await client.rpc('fork_item', {
                    p_item: itemId,
                    p_token: token ?? '',
                }),
            )
        },
        async recordDownload(itemId) {
            unwrap(await client.rpc('record_download', { p_item: itemId }))
        },
        async uploadImage(ownerId, itemId, file, fileName) {
            const safe = fileName.replace(/[^A-Za-z0-9._-]/g, '_').slice(-80)
            const path = `${ownerId}/${itemId}/${safe}`
            const { error } = await client.storage
                .from(IMAGE_BUCKET)
                .upload(path, file, { upsert: true, contentType: file.type })
            if (error) throw error
            return path
        },
    }
}
