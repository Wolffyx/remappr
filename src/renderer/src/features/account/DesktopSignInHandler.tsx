// Pattern check: no GoF pattern (-) — rejected — one dialog with three states calling the shared handoff helper
//
// The browser half of desktop sign-in (lib/cloud/desktopHandoff). The app
// opens the site at /?desktop-signin=<state>; this dialog signs the user in
// here (any method) and then, on "Open Remappr", files a one-time login for
// the app and opens remappr://auth/handoff. The app also checks on its own, so
// it signs in even where that link does not open.
import { useEffect, useState } from 'react'
import { ExternalLink, LogIn, MonitorCheck } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/ui/button'
import { Modal } from '@/ui/modal'
import {
    desktopSignInState,
    fileHandoff,
    forgetDesktopSignInState,
} from '@/lib/cloud/desktopHandoff'
import { cloudErrorMessage } from '@/lib/cloud/errors'
import useAuthStore from '@/stores/authStore'
import { SignInPanel } from './SignInPanel'

const HANDOFF_ERRORS: Record<string, string> = {
    state_used:
        'This sign-in was already sent to the app. Start again from Remappr.',
}

export function DesktopSignInHandler(): JSX.Element | null {
    const [state, setState] = useState<string | null>(desktopSignInState)
    const status = useAuthStore((s) => s.status)
    const email = useAuthStore((s) => s.user?.email ?? '')
    const init = useAuthStore((s) => s.init)
    const signOut = useAuthStore((s) => s.signOut)
    const [busy, setBusy] = useState(false)
    const [sent, setSent] = useState(false)

    useEffect(() => {
        if (state) void init()
    }, [state, init])

    if (!state) return null
    const link = `remappr://auth/handoff?state=${state}`

    const close = (): void => {
        forgetDesktopSignInState()
        setState(null)
    }

    const openApp = async (): Promise<void> => {
        setBusy(true)
        try {
            await fileHandoff(state)
            forgetDesktopSignInState()
            setSent(true)
            window.location.href = link
        } catch (e) {
            const code = e instanceof Error ? e.message : ''
            if (code === 'not_authenticated') {
                // The session here was ended elsewhere (a sign-out on another
                // device): drop it and ask to sign in again.
                await signOut().catch(() => undefined)
                toast.info('Your sign-in here has ended. Sign in again.')
                return
            }
            toast.error(HANDOFF_ERRORS[code] ?? cloudErrorMessage(e))
        } finally {
            setBusy(false)
        }
    }

    return (
        <Modal
            size="sm"
            kind="readonly"
            // Blocks closing by an outside click or Escape (a click on a
            // toast counts as outside): only Close or the X end the sign-in.
            isDismissable
            opened
            onClose={close}
            title="Sign in to the Remappr app"
            subtitle={
                sent
                    ? 'Done'
                    : status === 'signed_in'
                      ? `Signed in as ${email}`
                      : 'Sign in here, then go back to the app'
            }
            headerIcon={sent ? <MonitorCheck /> : <LogIn />}
        >
            {sent ? (
                <div className="space-y-3 text-sm">
                    <p className="text-muted-foreground">
                        Remappr is signing you in. You can close this tab.
                    </p>
                    <a
                        href={link}
                        className="inline-flex items-center gap-1.5 text-sm underline underline-offset-2"
                    >
                        <ExternalLink className="size-3.5" /> Open Remappr again
                    </a>
                </div>
            ) : status === 'signed_in' ? (
                <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                        Your browser stays signed in too. The app link works
                        once and only for the app that asked for it.
                    </p>
                    <Button
                        className="w-full"
                        disabled={busy}
                        onClick={() => void openApp()}
                    >
                        <ExternalLink className="size-4" />
                        {busy ? 'Opening…' : 'Open Remappr'}
                    </Button>
                </div>
            ) : status === 'signed_out' ? (
                <SignInPanel />
            ) : (
                <p className="text-sm text-muted-foreground">Loading…</p>
            )}
        </Modal>
    )
}
