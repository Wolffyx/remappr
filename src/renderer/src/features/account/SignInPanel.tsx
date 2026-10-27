// Pattern check: no GoF pattern (-) — rejected — a two-step form (email → code)
// plus provider buttons, all calling authStore actions.
//
// Sign in with a 6-digit email code or GitHub / Discord / Google. On desktop a
// provider opens the system browser; the code returns over remappr:// or, where
// that link can't be registered (AppImage, tar.gz), is pasted here.
import { useState } from 'react'
import { ArrowLeft, Mail } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/ui/button'
import { Input } from '@/ui/input'
import { Label } from '@/ui/label'
import { codeFromPaste } from '@/lib/cloud/authRedirect'
import { cloudErrorMessage } from '@/lib/cloud/errors'
import useAuthStore, { type AuthProvider } from '@/stores/authStore'
import { isElectron } from '@/transport'
import { PRIVACY_URL, TERMS_URL } from '@/lib/legal'

const PROVIDERS: readonly { id: AuthProvider; label: string }[] = [
    { id: 'github', label: 'GitHub' },
    { id: 'discord', label: 'Discord' },
    { id: 'google', label: 'Google' },
]

export function SignInPanel(): JSX.Element {
    const sendEmailCode = useAuthStore((s) => s.sendEmailCode)
    const verifyEmailCode = useAuthStore((s) => s.verifyEmailCode)
    const signInWithProvider = useAuthStore((s) => s.signInWithProvider)
    const completeWithCode = useAuthStore((s) => s.completeWithCode)
    const [email, setEmail] = useState('')
    const [code, setCode] = useState('')
    const [step, setStep] = useState<'email' | 'code'>('email')
    const [busy, setBusy] = useState(false)
    const [waitingForBrowser, setWaitingForBrowser] = useState(false)
    const [pasted, setPasted] = useState('')
    const desktop = isElectron()

    const run = async (task: () => Promise<void>): Promise<void> => {
        setBusy(true)
        try {
            await task()
        } catch (e) {
            toast.error(cloudErrorMessage(e))
        } finally {
            setBusy(false)
        }
    }

    const handleSend = (e: React.FormEvent): void => {
        e.preventDefault()
        void run(async () => {
            await sendEmailCode(email.trim())
            setStep('code')
            toast.success(`Code sent to ${email.trim()}`)
        })
    }

    const handleVerify = (e: React.FormEvent): void => {
        e.preventDefault()
        void run(() => verifyEmailCode(email.trim(), code.trim()))
    }

    const handleProvider = (provider: AuthProvider): void => {
        void run(async () => {
            await signInWithProvider(provider)
            if (desktop) setWaitingForBrowser(true)
        })
    }

    const handlePaste = (e: React.FormEvent): void => {
        e.preventDefault()
        const found = codeFromPaste(pasted)
        if (!found) {
            toast.error('That is not a sign-in code')
            return
        }
        void run(() => completeWithCode(found))
    }

    return (
        <div className="space-y-5">
            {step === 'email' ? (
                <form onSubmit={handleSend} className="space-y-2">
                    <Label htmlFor="signin-email">Email</Label>
                    <div className="flex gap-2">
                        <Input
                            id="signin-email"
                            type="email"
                            autoComplete="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="you@example.com"
                        />
                        <Button type="submit" disabled={busy || !email.trim()}>
                            <Mail className="size-4" /> Send code
                        </Button>
                    </div>
                </form>
            ) : (
                <form onSubmit={handleVerify} className="space-y-2">
                    <Label htmlFor="signin-code">
                        6-digit code sent to {email.trim()}
                    </Label>
                    <div className="flex gap-2">
                        <Input
                            id="signin-code"
                            inputMode="numeric"
                            autoComplete="one-time-code"
                            pattern="[0-9]{6}"
                            maxLength={6}
                            required
                            value={code}
                            onChange={(e) => setCode(e.target.value)}
                            placeholder="123456"
                            className="font-mono tracking-widest"
                        />
                        <Button
                            type="submit"
                            disabled={busy || code.length !== 6}
                        >
                            Sign in
                        </Button>
                    </div>
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                            setStep('email')
                            setCode('')
                        }}
                    >
                        <ArrowLeft className="size-4" /> Use another email
                    </Button>
                </form>
            )}

            <div className="space-y-2">
                <div className="eyebrow">Or continue with</div>
                <div className="flex flex-wrap gap-2">
                    {PROVIDERS.map((p) => (
                        <Button
                            key={p.id}
                            variant="outline"
                            disabled={busy}
                            onClick={() => handleProvider(p.id)}
                        >
                            {p.label}
                        </Button>
                    ))}
                </div>
            </div>

            <p className="text-xs text-muted-foreground">
                Signing in means you agree to the{' '}
                <a
                    href={TERMS_URL}
                    target="_blank"
                    rel="noreferrer"
                    className="underline underline-offset-2"
                >
                    terms
                </a>{' '}
                and the{' '}
                <a
                    href={PRIVACY_URL}
                    target="_blank"
                    rel="noreferrer"
                    className="underline underline-offset-2"
                >
                    privacy policy
                </a>
                .
            </p>

            {desktop && waitingForBrowser && (
                <form onSubmit={handlePaste} className="space-y-2">
                    <Label htmlFor="signin-paste">
                        Finish in your browser. If Remappr does not open by
                        itself, paste the code the page shows:
                    </Label>
                    <div className="flex gap-2">
                        <Input
                            id="signin-paste"
                            value={pasted}
                            onChange={(e) => setPasted(e.target.value)}
                            placeholder="Sign-in code"
                            className="font-mono"
                        />
                        <Button type="submit" disabled={busy || !pasted.trim()}>
                            Continue
                        </Button>
                    </div>
                </form>
            )}
        </div>
    )
}
