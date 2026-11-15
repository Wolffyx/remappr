// Pattern check: no GoF pattern (-) — rejected — an admin-only panel over
// SocialLibrary's queue RPCs plus authStore's TOTP step-up; the server checks
// role and aal2 on every call.
//
// Settings → Account → Moderation (admins only). Moderation needs a second
// factor: an admin adds an authenticator app once, then enters a code each
// session. The queue groups open reports per item or comment, newest-most
// reported first; acting (keep, hide) or dismissing closes the reports.
import { useCallback, useEffect, useState } from 'react'
import { Check, EyeOff, ShieldCheck, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/ui/button'
import { Input } from '@/ui/input'
import { Label } from '@/ui/label'
import { cloudErrorMessage } from '@/lib/cloud/errors'
import type { QueueEntry } from '@/lib/library/socialLibrary'
import useAuthStore, { type TotpEnrollment } from '@/stores/authStore'
import { getSocial } from '@/features/community/community'

const CODE_RE = /^\d{6}$/

function StepUp(): JSX.Element {
    const enrollTotp = useAuthStore((s) => s.enrollTotp)
    const totpFactorId = useAuthStore((s) => s.totpFactorId)
    const verifyTotp = useAuthStore((s) => s.verifyTotp)
    const [factorId, setFactorId] = useState<string | null>(null)
    const [enrollment, setEnrollment] = useState<TotpEnrollment | null>(null)
    const [code, setCode] = useState('')

    useEffect(() => {
        let live = true
        totpFactorId()
            .then((id) => {
                if (live) setFactorId(id)
            })
            .catch((e: unknown) => toast.error(cloudErrorMessage(e)))
        return () => {
            live = false
        }
    }, [totpFactorId])

    const enroll = async (): Promise<void> => {
        try {
            setEnrollment(await enrollTotp())
        } catch (e) {
            toast.error(cloudErrorMessage(e))
        }
    }

    const verify = async (): Promise<void> => {
        const id = enrollment?.factorId ?? factorId
        if (!id) return
        try {
            await verifyTotp(id, code)
            setCode('')
            toast.success('Verified')
        } catch (e) {
            toast.error(cloudErrorMessage(e))
        }
    }

    const needsSetup = !factorId && !enrollment
    return (
        <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
                Moderation needs a second sign-in step with an authenticator
                app.
            </p>
            {needsSetup && (
                <Button variant="outline" onClick={() => void enroll()}>
                    <ShieldCheck className="size-4" /> Set up an authenticator
                    app
                </Button>
            )}
            {enrollment && (
                <div className="space-y-2">
                    <img
                        src={enrollment.qrCode}
                        alt="Authenticator QR code"
                        className="size-40 rounded-lg bg-white p-2"
                    />
                    <p className="text-xs break-all text-muted-foreground">
                        Or enter this key:{' '}
                        <span className="font-mono">{enrollment.secret}</span>
                    </p>
                </div>
            )}
            {!needsSetup && (
                <div className="space-y-1.5">
                    <Label htmlFor="mfa-code">
                        Code from your authenticator
                    </Label>
                    <div className="flex gap-2">
                        <Input
                            id="mfa-code"
                            inputMode="numeric"
                            autoComplete="one-time-code"
                            maxLength={6}
                            value={code}
                            onChange={(e) =>
                                setCode(e.target.value.replace(/\D/g, ''))
                            }
                            placeholder="123456"
                        />
                        <Button
                            disabled={!CODE_RE.test(code)}
                            onClick={() => void verify()}
                        >
                            Verify
                        </Button>
                    </div>
                </div>
            )}
        </div>
    )
}

function QueueRow({
    entry,
    onDone,
}: {
    entry: QueueEntry
    onDone: () => Promise<void>
}): JSX.Element {
    const act = async (
        task: () => Promise<void>,
        done: string,
    ): Promise<void> => {
        try {
            await task()
            toast.success(done)
            await onDone()
        } catch (e) {
            toast.error(cloudErrorMessage(e))
        }
    }
    const social = async (): Promise<
        NonNullable<Awaited<ReturnType<typeof getSocial>>>
    > => {
        const s = await getSocial()
        if (!s) throw new Error('No backend')
        return s
    }
    return (
        <li className="space-y-1.5 rounded-lg border p-3">
            <div className="text-xs text-muted-foreground">
                {entry.target === 'item'
                    ? 'Item'
                    : `Comment on "${entry.title}"`}{' '}
                · {entry.reports} report{entry.reports === 1 ? '' : 's'} ·{' '}
                {entry.reasons.join(', ')} · {entry.moderation}
            </div>
            <div className="text-sm font-semibold">
                {entry.target === 'item' ? entry.title : entry.body}
            </div>
            {entry.target === 'item' && entry.body && (
                <p className="text-xs text-muted-foreground">{entry.body}</p>
            )}
            {entry.owner && (
                <p className="text-xs text-muted-foreground">
                    by {entry.owner}
                </p>
            )}
            {entry.notes.map((n, i) => (
                <p key={i} className="text-xs italic">
                    “{n}”
                </p>
            ))}
            <div className="flex flex-wrap gap-2">
                <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                        void act(
                            async () =>
                                (await social()).moderate(
                                    entry.target,
                                    entry.id,
                                    'ok',
                                ),
                            'Kept',
                        )
                    }
                >
                    <Check className="size-3.5" /> Keep
                </Button>
                <Button
                    size="sm"
                    variant="destructive"
                    onClick={() =>
                        void act(
                            async () =>
                                (await social()).moderate(
                                    entry.target,
                                    entry.id,
                                    'hidden',
                                ),
                            'Hidden',
                        )
                    }
                >
                    <EyeOff className="size-3.5" /> Hide
                </Button>
                <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                        void act(
                            async () =>
                                (await social()).dismiss(
                                    entry.target,
                                    entry.id,
                                ),
                            'Reports dismissed',
                        )
                    }
                >
                    <X className="size-3.5" /> Dismiss reports
                </Button>
            </div>
        </li>
    )
}

async function fetchQueue(): Promise<QueueEntry[]> {
    const social = await getSocial()
    return social ? social.queue() : []
}

function Queue(): JSX.Element {
    const [entries, setEntries] = useState<QueueEntry[] | null>(null)
    const reload = useCallback(
        (): Promise<void> => fetchQueue().then(setEntries),
        [],
    )
    useEffect(() => {
        let live = true
        fetchQueue()
            .then((q) => {
                if (live) setEntries(q)
            })
            .catch((e: unknown) => toast.error(cloudErrorMessage(e)))
        return () => {
            live = false
        }
    }, [])
    if (!entries)
        return <p className="text-sm text-muted-foreground">Loading…</p>
    if (entries.length === 0)
        return <p className="text-sm text-muted-foreground">No open reports.</p>
    return (
        <ul className="space-y-2">
            {entries.map((e) => (
                <QueueRow
                    key={`${e.target}:${e.id}`}
                    entry={e}
                    onDone={reload}
                />
            ))}
        </ul>
    )
}

export function ModerationQueue(): JSX.Element | null {
    const user = useAuthStore((s) => s.user)
    if (!user?.isAdmin) return null
    return (
        <div className="space-y-3 rounded-xl border bg-background p-4">
            <div className="flex items-center gap-2 text-panel-title font-semibold">
                <ShieldCheck className="size-4" /> Moderation
            </div>
            {user.aal === 'aal2' ? <Queue /> : <StepUp />}
        </div>
    )
}
