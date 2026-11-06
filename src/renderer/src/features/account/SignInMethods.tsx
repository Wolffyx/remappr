// Pattern check: no GoF pattern (-) — rejected — one settings card listing
// the account's identities with link / unlink buttons bound to authStore.
//
// Settings → Account → Sign-in methods: every way into this account (the
// email code, GitHub, Discord, Google). Linking a provider here means that
// signing in with it later opens this account instead of making a new one.
// The last method cannot be removed.
import { useEffect, useState } from 'react'
import { Link2, Unlink, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/ui/button'
import { Input } from '@/ui/input'
import { codeFromPaste } from '@/lib/cloud/authRedirect'
import { cloudErrorMessage } from '@/lib/cloud/errors'
import {
    providerLabel,
    type AuthProvider,
    type LinkedIdentity,
} from '@/lib/cloud/identities'
import useAuthStore from '@/stores/authStore'
import { isElectron } from '@/transport'
import { useEnabledProviders } from './useEnabledProviders'

/** Desktop: the code from the bounce page, where remappr:// does not open. */
function PasteLinkCode(): JSX.Element {
    const completeWithCode = useAuthStore((s) => s.completeWithCode)
    const [text, setText] = useState('')
    const submit = (e: React.FormEvent): void => {
        e.preventDefault()
        const code = codeFromPaste(text)
        if (!code) {
            toast.error('That is not a sign-in code.')
            return
        }
        completeWithCode(code).catch((err: unknown) =>
            toast.error(cloudErrorMessage(err)),
        )
    }
    return (
        <form className="flex gap-2" onSubmit={submit}>
            <Input
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Paste the code from the browser"
                aria-label="Sign-in code"
            />
            <Button type="submit" variant="outline" disabled={!text.trim()}>
                Use code
            </Button>
        </form>
    )
}

export function LinkWaiting({
    provider,
}: {
    provider: AuthProvider
}): JSX.Element {
    const cancelLink = useAuthStore((s) => s.cancelLink)
    return (
        <div className="space-y-2 rounded-lg border px-3 py-2">
            <div className="flex items-center gap-2 text-sm">
                <span className="flex-1">
                    Finish linking {providerLabel(provider)} in your browser…
                </span>
                <Button variant="ghost" size="sm" onClick={cancelLink}>
                    <X className="size-3.5" /> Cancel
                </Button>
            </div>
            <PasteLinkCode />
        </div>
    )
}

const NONE: LinkedIdentity[] = []

export function SignInMethods(): JSX.Element {
    const identities = useAuthStore((s) => s.user?.identities ?? NONE)
    const linking = useAuthStore((s) => s.linking)
    const linkProvider = useAuthStore((s) => s.linkProvider)
    const unlinkIdentity = useAuthStore((s) => s.unlinkIdentity)
    const refreshIdentities = useAuthStore((s) => s.refreshIdentities)
    const [busy, setBusy] = useState(false)
    const providers = useEnabledProviders() ?? []

    // A method linked on another device is missing from this session's copy.
    useEffect(() => {
        void refreshIdentities()
    }, [refreshIdentities])

    const run = async (
        task: () => Promise<void>,
        done?: string,
    ): Promise<void> => {
        setBusy(true)
        try {
            await task()
            if (done) toast.success(done)
        } catch (e) {
            toast.error(cloudErrorMessage(e))
        } finally {
            setBusy(false)
        }
    }

    const linkable = providers.filter(
        (p) => !identities.some((i) => i.provider === p.id),
    )
    const removable = identities.length > 1

    return (
        <div className="space-y-2 rounded-xl border bg-background p-4">
            <div className="flex items-center gap-2">
                <Link2 className="size-4" />
                <span className="flex-1 text-panel-title font-semibold">
                    Sign-in methods
                </span>
            </div>
            <p className="text-xs text-muted-foreground">
                {providers.length > 0
                    ? 'Every way into this account. Link a provider here before you sign in with it, or it makes a separate, empty account.'
                    : 'Every way into this account. This server signs in with an email code only.'}
            </p>
            <ul className="space-y-1.5">
                {identities.map((i) => (
                    <li
                        key={i.id}
                        className="flex items-center gap-2 rounded-lg border px-3 py-2"
                    >
                        <span className="min-w-0 flex-1">
                            <span className="block text-sm font-semibold">
                                {providerLabel(i.provider)}
                            </span>
                            {i.label && (
                                <span className="block truncate text-xs text-muted-foreground">
                                    {i.label}
                                </span>
                            )}
                        </span>
                        {removable && (
                            <Button
                                size="sm"
                                variant="ghost"
                                disabled={busy}
                                onClick={() =>
                                    void run(
                                        () => unlinkIdentity(i.id),
                                        `${providerLabel(i.provider)} removed`,
                                    )
                                }
                            >
                                <Unlink className="size-3.5" /> Remove
                            </Button>
                        )}
                    </li>
                ))}
            </ul>
            {linking && isElectron() ? (
                <LinkWaiting provider={linking} />
            ) : (
                linkable.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                        {linkable.map((p) => (
                            <Button
                                key={p.id}
                                size="sm"
                                variant="outline"
                                disabled={busy}
                                onClick={() =>
                                    void run(() => linkProvider(p.id))
                                }
                            >
                                <Link2 className="size-3.5" /> Link {p.label}
                            </Button>
                        ))}
                    </div>
                )
            )}
        </div>
    )
}
