// Pattern check: Repository (Tier 0) — applied — stars, comments, reports and
// moderation behind one contract; tables are read under RLS, every privileged
// change is an RPC the server checks.
//
// The social side of the community: star an item, talk about it (one reply
// level), report what should not be there, and — for admins with a two-factor
// session — work the moderation queue.
import type { CloudClient } from '@/lib/cloud/client'

export type ReportReason =
    | 'spam'
    | 'malicious_macro'
    | 'broken'
    | 'inappropriate'
    | 'copyright'
    | 'other'

export const REPORT_REASONS: readonly { id: ReportReason; label: string }[] = [
    { id: 'malicious_macro', label: 'Harmful macro' },
    { id: 'broken', label: 'Broken or does not load' },
    { id: 'spam', label: 'Spam' },
    { id: 'inappropriate', label: 'Inappropriate' },
    { id: 'copyright', label: 'Copied without permission' },
    { id: 'other', label: 'Something else' },
]

export type ReportTarget = { itemId: string } | { commentId: string }
export type ModerationTarget = 'item' | 'comment'

export interface Comment {
    id: string
    parentId: string | null
    /** null once the author deleted their account ("[deleted]"). */
    author: string | null
    authorId: string | null
    body: string
    createdAt: string
    edited: boolean
    deleted: boolean
    hidden: boolean
}

export interface QueueEntry {
    target: ModerationTarget
    id: string
    itemId: string
    title: string
    body: string
    owner: string | null
    moderation: string
    reports: number
    reasons: string[]
    notes: string[]
    firstReported: string
}

export interface SocialLibrary {
    isStarred(itemId: string): Promise<boolean>
    star(itemId: string): Promise<void>
    unstar(itemId: string): Promise<void>
    /** The item's comments, oldest first; replies follow their parent's id. */
    comments(itemId: string): Promise<Comment[]>
    addComment(itemId: string, body: string, parentId?: string): Promise<void>
    editComment(commentId: string, body: string): Promise<void>
    deleteComment(commentId: string): Promise<void>
    hideComment(commentId: string): Promise<void>
    report(
        target: ReportTarget,
        reason: ReportReason,
        note: string,
    ): Promise<void>
    queue(): Promise<QueueEntry[]>
    moderate(
        target: ModerationTarget,
        id: string,
        status: 'ok' | 'flagged' | 'hidden',
    ): Promise<void>
    dismiss(target: ModerationTarget, id: string): Promise<void>
}

interface ErrorLike {
    message?: string
}

function check(res: { error: ErrorLike | null }): void {
    if (res.error) throw res.error
}

export function createSocialLibrary(client: CloudClient): SocialLibrary {
    return {
        async isStarred(itemId) {
            const { count, error } = await client
                .from('item_stars')
                .select('item_id', { count: 'exact', head: true })
                .eq('item_id', itemId)
            if (error) throw error
            return (count ?? 0) > 0
        },
        async star(itemId) {
            check(await client.from('item_stars').insert({ item_id: itemId }))
        },
        async unstar(itemId) {
            check(
                await client.from('item_stars').delete().eq('item_id', itemId),
            )
        },
        async comments(itemId) {
            const { data, error } = await client
                .from('item_comments')
                .select(
                    'id, parent_id, author_id, body, created_at, edited_at, deleted_at, moderation, users!item_comments_author_id_fkey(username)',
                )
                .eq('item_id', itemId)
                .order('created_at')
            if (error) throw error
            return data.map((c) => ({
                id: c.id,
                parentId: c.parent_id,
                author:
                    (c.users as { username?: string | null } | null)
                        ?.username ?? null,
                authorId: c.author_id,
                body: c.body,
                createdAt: c.created_at,
                edited: !!c.edited_at,
                deleted: !!c.deleted_at,
                hidden: c.moderation !== 'ok',
            }))
        },
        async addComment(itemId, body, parentId) {
            check(
                await client.from('item_comments').insert({
                    item_id: itemId,
                    body,
                    parent_id: parentId ?? null,
                }),
            )
        },
        async editComment(commentId, body) {
            check(
                await client
                    .from('item_comments')
                    .update({ body })
                    .eq('id', commentId),
            )
        },
        async deleteComment(commentId) {
            check(await client.rpc('delete_comment', { p_comment: commentId }))
        },
        async hideComment(commentId) {
            check(await client.rpc('hide_comment', { p_comment: commentId }))
        },
        async report(target, reason, note) {
            const row = {
                item_id: 'itemId' in target ? target.itemId : null,
                comment_id: 'commentId' in target ? target.commentId : null,
                reason,
                note,
            }
            check(await client.from('content_reports').insert(row))
        },
        async queue() {
            const { data, error } = await client.rpc('moderation_queue')
            if (error) throw error
            return data.map((r) => ({
                target: r.target as ModerationTarget,
                id: r.id,
                itemId: r.item_id,
                title: r.title,
                body: r.body,
                owner: r.owner_username,
                moderation: r.moderation,
                reports: r.reports,
                reasons: r.reasons ?? [],
                notes: r.notes ?? [],
                firstReported: r.first_reported,
            }))
        },
        async moderate(target, id, status) {
            check(
                await client.rpc('moderate', {
                    p_target: target,
                    p_id: id,
                    p_status: status,
                }),
            )
        },
        async dismiss(target, id) {
            check(
                await client.rpc('dismiss_reports', {
                    p_target: target,
                    p_id: id,
                }),
            )
        },
    }
}
