// Pattern check: no GoF pattern (-) — rejected — one small panel driving the shared startDesktopSignIn helper
//
// Desktop sign-in: "Sign in with your browser" opens the site, where the user
// signs in any way they like and presses "Open Remappr". The app then collects
// its one-time login (lib/cloud/desktopHandoff): at once when the
// remappr://auth/handoff link arrives, else by checking every few seconds, so
// it also works where that link does not open (AppImage, tar.gz).
import { useEffect, useRef, useState } from 'react'
import { Globe, X } from 'lucide-react'
import { toast } from 'sonner'
import { IpcEvents } from '@shared/ipc-types'
import { Button } from '@/ui/button'
import {
    startDesktopSignIn,
    type DesktopSignIn,
} from '@/lib/cloud/desktopHandoff'
import { cloudErrorMessage } from '@/lib/cloud/errors'

interface IpcBridge {
    on(event: string, cb: (payload: unknown) => void): () => void
}

function bridge(): IpcBridge | null {
    return (globalThis as { api?: IpcBridge }).api ?? null
}

export function BrowserSignIn(): JSX.Element {
    const [waiting, setWaiting] = useState(false)
    const current = useRef<DesktopSignIn | null>(null)

    // The link from the browser: claim now instead of at the next check.
    useEffect(() => {
        const off = bridge()?.on(IpcEvents.AUTH_HANDOFF, (payload) => {
            const state = (payload as { state?: unknown })?.state
            if (state === current.current?.state) current.current?.nudge()
        })
        return () => {
            off?.()
            current.current?.cancel()
        }
    }, [])

    const start = async (): Promise<void> => {
        current.current?.cancel()
        setWaiting(true)
        try {
            current.current = await startDesktopSignIn({
                onDone: () => {
                    current.current = null
                    setWaiting(false)
                    toast.success('Signed in')
                },
                onError: (e) => {
                    current.current = null
                    setWaiting(false)
                    toast.error(cloudErrorMessage(e))
                },
            })
        } catch (e) {
            setWaiting(false)
            toast.error(cloudErrorMessage(e))
        }
    }

    const cancel = (): void => {
        current.current?.cancel()
        current.current = null
        setWaiting(false)
    }

    if (waiting)
        return (
            <div className="space-y-3 rounded-xl border bg-background p-4">
                <p className="text-sm">
                    Finish signing in in your browser, then press{' '}
                    <strong>Open Remappr</strong>.
                </p>
                <p className="text-xs text-muted-foreground">
                    Remappr signs you in as soon as you do. It waits up to 10
                    minutes.
                </p>
                <div className="flex flex-wrap gap-2">
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={() => void start()}
                    >
                        <Globe className="size-3.5" /> Open the browser again
                    </Button>
                    <Button size="sm" variant="ghost" onClick={cancel}>
                        <X className="size-3.5" /> Cancel
                    </Button>
                </div>
            </div>
        )

    return (
        <div className="space-y-2">
            <Button className="w-full" onClick={() => void start()}>
                <Globe className="size-4" /> Sign in with your browser
            </Button>
            <p className="text-xs text-muted-foreground">
                Opens the Remappr website, where you sign in with email, GitHub,
                Discord or Google.
            </p>
        </div>
    )
}
