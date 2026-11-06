// Pattern check: no GoF pattern (-) — rejected — one dialog reading two
// stores; the decision itself is githubLinkVerdict.
//
// Right after Connect GitHub (Settings → Integrations) while signed in to
// Remappr: if the account has no GitHub sign-in yet, offer to link it, so
// "Continue with GitHub" later opens this account instead of making a new
// one. If the account signs in with a different GitHub login, say so.
import { useEffect } from 'react'
import { Link2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/ui/button'
import { Modal } from '@/ui/modal'
import { cloudErrorMessage } from '@/lib/cloud/errors'
import {
    githubLinkVerdict,
    githubLoginOf,
    type LinkedIdentity,
} from '@/lib/cloud/identities'
import useAuthStore from '@/stores/authStore'
import useGithubStore from '@/stores/githubStore'
import { isElectron } from '@/transport'
import { LinkWaiting } from './SignInMethods'

const NONE: LinkedIdentity[] = []

export function LinkGithubOffer(): JSX.Element | null {
    const offer = useGithubStore((s) => s.linkOffer)
    const dismiss = useGithubStore((s) => s.dismissLinkOffer)
    const signedIn = useAuthStore((s) => s.status === 'signed_in')
    const email = useAuthStore((s) => s.user?.email ?? 'your account')
    const identities = useAuthStore((s) => s.user?.identities ?? NONE)
    const linking = useAuthStore((s) => s.linking)
    const linkProvider = useAuthStore((s) => s.linkProvider)
    const cancelLink = useAuthStore((s) => s.cancelLink)

    const linkedLogin = githubLoginOf(identities)
    const verdict = githubLinkVerdict(offer, signedIn, linkedLogin)

    useEffect(() => {
        if (verdict === 'ask') return
        if (verdict === 'other')
            toast.warning(
                `Your Remappr account signs in with @${linkedLogin}`,
                {
                    description: `GitHub features here use @${offer}, a different GitHub account.`,
                    duration: 12000,
                },
            )
        if (offer) dismiss()
    }, [verdict, offer, linkedLogin, dismiss])

    if (verdict !== 'ask') return null

    const close = (): void => {
        if (linking) cancelLink()
        dismiss()
    }

    const link = (): void => {
        linkProvider('github').catch((e: unknown) => {
            toast.error(cloudErrorMessage(e))
        })
    }

    return (
        <Modal
            size="sm"
            opened
            onClose={close}
            title="Link GitHub to your account?"
            subtitle={`Signed in to Remappr as ${email}`}
            headerIcon={<Link2 />}
            footer={
                linking ? undefined : (
                    <div className="flex w-full flex-wrap justify-end gap-2">
                        <Button variant="outline" onClick={close}>
                            Not now
                        </Button>
                        <Button onClick={link}>
                            <Link2 className="size-4" /> Link GitHub
                        </Button>
                    </div>
                )
            }
        >
            {linking && isElectron() ? (
                <LinkWaiting provider="github" />
            ) : (
                <div className="space-y-2 text-sm text-muted-foreground">
                    <p>
                        GitHub is connected as{' '}
                        <strong className="text-foreground">@{offer}</strong>.
                        Link it, and signing in with GitHub opens this Remappr
                        account. Without it, a GitHub sign-in with another email
                        makes a separate, empty account.
                    </p>
                    <p className="text-xs">
                        GitHub may ask once more to let Remappr sign you in. You
                        can manage this under Account → Sign-in methods.
                    </p>
                </div>
            )}
        </Modal>
    )
}
