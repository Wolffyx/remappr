// Pattern check: no GoF pattern (-) — rejected — a Settings section showing
// auth state; the profile form calls authStore.updateProfile.
//
// Settings → Account. Signed out: the sign-in panel. Signed in: the public
// profile (username is needed to publish) and sign-out. Profile edits save on
// their own button, apart from the dialog's Save / Cancel.
import { useEffect, useState } from 'react'
import { LogOut } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/ui/button'
import { Input } from '@/ui/input'
import { Label } from '@/ui/label'
import { cloudErrorMessage } from '@/lib/cloud/errors'
import useAuthStore from '@/stores/authStore'
import { SignInPanel } from './SignInPanel'

const USERNAME_RE = /^[a-z0-9][a-z0-9_-]{2,31}$/

/** Why a username is refused, in words; null when it is fine. */
function usernameProblem(name: string): string | null {
    if (!name) return null
    if (USERNAME_RE.test(name)) return null
    return '3–32 characters: lowercase letters, digits, - and _, starting with a letter or digit'
}

function ProfileForm(): JSX.Element {
    const user = useAuthStore((s) => s.user)
    const profile = useAuthStore((s) => s.profile)
    const updateProfile = useAuthStore((s) => s.updateProfile)
    const signOut = useAuthStore((s) => s.signOut)
    // Seeded from the profile; the parent remounts this form when it changes.
    const [username, setUsername] = useState(profile?.username ?? '')
    const [displayName, setDisplayName] = useState(profile?.display_name ?? '')
    const [bio, setBio] = useState(profile?.bio ?? '')
    const [busy, setBusy] = useState(false)

    const problem = usernameProblem(username.trim())

    const handleSave = async (e: React.FormEvent): Promise<void> => {
        e.preventDefault()
        setBusy(true)
        try {
            await updateProfile({
                username: username.trim() || null,
                display_name: displayName.trim() || null,
                bio: bio.trim(),
            })
            toast.success('Profile saved')
        } catch (err) {
            toast.error(cloudErrorMessage(err))
        } finally {
            setBusy(false)
        }
    }

    const handleSignOut = async (): Promise<void> => {
        try {
            await signOut()
            toast.success('Signed out')
        } catch (err) {
            toast.error(cloudErrorMessage(err))
        }
    }

    return (
        <div className="space-y-5">
            <div className="flex items-center gap-3 rounded-xl border bg-background p-4">
                {profile?.avatar_url && (
                    <img
                        src={profile.avatar_url}
                        alt=""
                        className="size-10 rounded-full"
                        referrerPolicy="no-referrer"
                    />
                )}
                <div className="min-w-0 flex-1">
                    <div className="truncate text-panel-title font-semibold">
                        {profile?.display_name ||
                            profile?.username ||
                            'Signed in'}
                    </div>
                    <div className="truncate text-xs text-muted-foreground">
                        {user?.email}
                    </div>
                </div>
                <Button variant="outline" onClick={() => void handleSignOut()}>
                    <LogOut className="size-4" /> Sign out
                </Button>
            </div>

            <form onSubmit={(e) => void handleSave(e)} className="space-y-3">
                <div className="space-y-1.5">
                    <Label htmlFor="account-username">Username</Label>
                    <Input
                        id="account-username"
                        value={username}
                        onChange={(e) =>
                            setUsername(e.target.value.toLowerCase())
                        }
                        placeholder="Needed to publish to the community"
                        aria-invalid={!!problem}
                    />
                    {problem && (
                        <p className="text-xs text-destructive">{problem}</p>
                    )}
                </div>
                <div className="space-y-1.5">
                    <Label htmlFor="account-display-name">Display name</Label>
                    <Input
                        id="account-display-name"
                        value={displayName}
                        maxLength={64}
                        onChange={(e) => setDisplayName(e.target.value)}
                    />
                </div>
                <div className="space-y-1.5">
                    <Label htmlFor="account-bio">Bio</Label>
                    <textarea
                        id="account-bio"
                        value={bio}
                        maxLength={500}
                        rows={3}
                        onChange={(e) => setBio(e.target.value)}
                        className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                    />
                </div>
                <Button type="submit" disabled={busy || !!problem}>
                    Save profile
                </Button>
            </form>
        </div>
    )
}

/** The account body without a heading: the header dialog has its own title. */
export function AccountPanel(): JSX.Element {
    const status = useAuthStore((s) => s.status)
    const init = useAuthStore((s) => s.init)
    const profileRev = useAuthStore((s) => s.profile?.updated_at ?? '')

    useEffect(() => {
        void init()
    }, [init])

    return (
        <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
                Optional. Everything works without an account; signing in adds
                cloud sync and publishing.
            </p>
            {status === 'loading' && (
                <p className="text-sm text-muted-foreground">Loading…</p>
            )}
            {status === 'signed_out' && <SignInPanel />}
            {status === 'signed_in' && <ProfileForm key={profileRev} />}
            {status === 'unconfigured' && (
                <p className="text-sm text-muted-foreground">
                    Accounts are not available in this build.
                </p>
            )}
        </div>
    )
}

/** Settings → Account. */
export function AccountSection(): JSX.Element {
    return (
        <div className="space-y-3">
            <h3 className="text-lg font-semibold">Account</h3>
            <AccountPanel />
        </div>
    )
}
