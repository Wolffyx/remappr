// Pattern check: no GoF pattern (-) — rejected — presentational thread over
// SocialLibrary; the server enforces who may post, edit, delete and hide.
//
// The comments under a public community item: top-level comments with one
// level of replies. Authors edit and delete their own; the item's owner can
// hide any; anyone signed in can report one. Posting needs a username.
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
    EyeOff,
    Flag,
    MessageSquare,
    Pencil,
    Reply,
    Trash2,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/ui/button'
import { cloudErrorMessage } from '@/lib/cloud/errors'
import type { Comment, ReportTarget } from '@/lib/library/socialLibrary'
import useAuthStore from '@/stores/authStore'
import { getSocial } from './community'
import { ReportDialog } from './ReportDialog'

const TEXTAREA =
    'w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50'

function Composer({
    placeholder,
    initial = '',
    onSend,
    onCancel,
}: {
    placeholder: string
    initial?: string
    onSend: (body: string) => Promise<void>
    onCancel?: () => void
}): JSX.Element {
    const [body, setBody] = useState(initial)
    const [busy, setBusy] = useState(false)
    const send = async (): Promise<void> => {
        setBusy(true)
        try {
            await onSend(body.trim())
            setBody('')
        } finally {
            setBusy(false)
        }
    }
    return (
        <div className="space-y-1.5">
            <textarea
                aria-label={placeholder}
                value={body}
                maxLength={4000}
                rows={2}
                placeholder={placeholder}
                onChange={(e) => setBody(e.target.value)}
                className={TEXTAREA}
            />
            <div className="flex justify-end gap-2">
                {onCancel && (
                    <Button size="sm" variant="ghost" onClick={onCancel}>
                        Cancel
                    </Button>
                )}
                <Button
                    size="sm"
                    disabled={busy || !body.trim()}
                    onClick={() => void send()}
                >
                    Post
                </Button>
            </div>
        </div>
    )
}

async function fetchComments(itemId: string): Promise<Comment[]> {
    const social = await getSocial()
    return social ? social.comments(itemId) : []
}

interface ThreadActions {
    userId: string | null
    canHide: boolean
    reply: (parentId: string, body: string) => Promise<void>
    edit: (id: string, body: string) => Promise<void>
    remove: (id: string) => Promise<void>
    hide: (id: string) => Promise<void>
    report: (id: string) => void
}

function CommentView({
    comment,
    actions,
    canReply,
}: {
    comment: Comment
    actions: ThreadActions
    canReply: boolean
}): JSX.Element {
    const [mode, setMode] = useState<'view' | 'reply' | 'edit'>('view')
    const mine = !!actions.userId && comment.authorId === actions.userId
    if (comment.deleted || comment.hidden)
        return (
            <p className="text-xs text-muted-foreground italic">
                {comment.deleted ? 'Deleted comment' : 'Hidden by the owner'}
            </p>
        )
    return (
        <div className="space-y-1">
            <div className="text-xs text-muted-foreground">
                <span className="font-semibold text-foreground">
                    {comment.author ?? '[deleted]'}
                </span>{' '}
                · {new Date(comment.createdAt).toLocaleDateString()}
                {comment.edited && ' · edited'}
            </div>
            {mode === 'edit' ? (
                <Composer
                    placeholder="Edit your comment"
                    initial={comment.body}
                    onCancel={() => setMode('view')}
                    onSend={async (body) => {
                        await actions.edit(comment.id, body)
                        setMode('view')
                    }}
                />
            ) : (
                <p className="text-sm whitespace-pre-line">{comment.body}</p>
            )}
            {mode === 'view' && actions.userId && (
                <div className="flex gap-1">
                    {canReply && (
                        <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setMode('reply')}
                        >
                            <Reply className="size-3.5" /> Reply
                        </Button>
                    )}
                    {mine && (
                        <Button
                            size="sm"
                            variant="ghost"
                            aria-label="Edit comment"
                            onClick={() => setMode('edit')}
                        >
                            <Pencil className="size-3.5" />
                        </Button>
                    )}
                    {mine && (
                        <Button
                            size="sm"
                            variant="ghost"
                            aria-label="Delete comment"
                            onClick={() => void actions.remove(comment.id)}
                        >
                            <Trash2 className="size-3.5" />
                        </Button>
                    )}
                    {!mine && actions.canHide && (
                        <Button
                            size="sm"
                            variant="ghost"
                            aria-label="Hide comment"
                            onClick={() => void actions.hide(comment.id)}
                        >
                            <EyeOff className="size-3.5" />
                        </Button>
                    )}
                    {!mine && (
                        <Button
                            size="sm"
                            variant="ghost"
                            aria-label="Report comment"
                            onClick={() => actions.report(comment.id)}
                        >
                            <Flag className="size-3.5" />
                        </Button>
                    )}
                </div>
            )}
            {mode === 'reply' && (
                <Composer
                    placeholder="Write a reply"
                    onCancel={() => setMode('view')}
                    onSend={async (body) => {
                        await actions.reply(comment.id, body)
                        setMode('view')
                    }}
                />
            )}
        </div>
    )
}

export function CommentsSection({
    itemId,
    ownerId,
    isPublic,
}: {
    itemId: string
    ownerId: string
    /** Comments are open on public items only. */
    isPublic: boolean
}): JSX.Element {
    const userId = useAuthStore((s) => s.user?.id ?? null)
    const username = useAuthStore((s) => s.profile?.username ?? null)
    const [comments, setComments] = useState<Comment[]>([])
    const [reporting, setReporting] = useState<ReportTarget | null>(null)

    const load = useCallback(
        (): Promise<void> => fetchComments(itemId).then(setComments),
        [itemId],
    )

    useEffect(() => {
        let live = true
        fetchComments(itemId)
            .then((c) => {
                if (live) setComments(c)
            })
            .catch((e: unknown) => toast.error(cloudErrorMessage(e)))
        return () => {
            live = false
        }
    }, [itemId])

    const act =
        <A extends unknown[]>(task: (...args: A) => Promise<void>) =>
        async (...args: A): Promise<void> => {
            try {
                await task(...args)
                await load()
            } catch (e) {
                toast.error(cloudErrorMessage(e))
            }
        }

    const actions: ThreadActions = {
        userId,
        canHide: userId === ownerId,
        reply: act(async (parentId, body) =>
            (await getSocial())?.addComment(itemId, body, parentId),
        ),
        edit: act(async (id, body) =>
            (await getSocial())?.editComment(id, body),
        ),
        remove: act(async (id) => (await getSocial())?.deleteComment(id)),
        hide: act(async (id) => (await getSocial())?.hideComment(id)),
        report: (id) => setReporting({ commentId: id }),
    }

    const threads = useMemo(() => {
        const top = comments.filter((c) => !c.parentId)
        return top.map((c) => ({
            comment: c,
            replies: comments.filter((r) => r.parentId === c.id),
        }))
    }, [comments])

    return (
        <div className="space-y-2">
            <div className="eyebrow flex items-center gap-1">
                <MessageSquare className="size-3.5" /> Comments (
                {comments.filter((c) => !c.deleted && !c.hidden).length})
            </div>
            {threads.map(({ comment, replies }) => (
                <div
                    key={comment.id}
                    className="space-y-2 rounded-lg border p-2"
                >
                    <CommentView
                        comment={comment}
                        actions={actions}
                        canReply={isPublic && !!username}
                    />
                    {replies.map((r) => (
                        <div key={r.id} className="ml-4 border-l pl-3">
                            <CommentView
                                comment={r}
                                actions={actions}
                                canReply={false}
                            />
                        </div>
                    ))}
                </div>
            ))}
            {!isPublic && (
                <p className="text-xs text-muted-foreground">
                    Comments open once the item is public.
                </p>
            )}
            {isPublic && !userId && (
                <p className="text-xs text-muted-foreground">
                    Sign in to comment.
                </p>
            )}
            {isPublic && userId && !username && (
                <p className="text-xs text-muted-foreground">
                    Pick a username in Settings → Account to comment.
                </p>
            )}
            {isPublic && username && (
                <Composer
                    placeholder="Add a comment"
                    onSend={act(async (body) =>
                        (await getSocial())?.addComment(itemId, body),
                    )}
                />
            )}
            <ReportDialog
                target={reporting}
                what="this comment"
                onClose={() => setReporting(null)}
            />
        </div>
    )
}
