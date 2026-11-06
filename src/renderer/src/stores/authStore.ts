// Pattern check: no GoF pattern (-) — rejected — zustand store over supabase-js
// auth; the client comes from the getCloudClient seam (null → 'unconfigured').
//
// Accounts are optional. A build without a backend stays 'unconfigured' and
// nothing cloud renders. Sign-in is a 6-digit email code or an OAuth provider;
// on desktop the provider's code comes back over remappr:// (main/deep-link.ts)
// or is pasted from the bounce page.
//
// One account can sign in several ways: Account → Sign-in methods links a
// provider to the signed-in account (linkProvider) so it does not make a
// second account. A session that replaces another account's is announced.
import { create } from 'zustand'
import { toast } from 'sonner'
import type { Session } from '@supabase/supabase-js'
import { createLogger } from '@shared/logger'
import { IpcChannels, IpcEvents } from '@shared/ipc-types'
import { getCloudClient, type CloudClient } from '@/lib/cloud/client'
import {
    authRedirectError,
    oauthRedirectTo,
    stripAuthParams,
} from '@/lib/cloud/authRedirect'
import { cloudErrorMessage } from '@/lib/cloud/errors'
import {
    identitiesOf,
    isNewProviderAccount,
    providerLabel,
    type AuthProvider,
    type LinkedIdentity,
} from '@/lib/cloud/identities'
import { refreshPlan } from '@/lib/entitlements/plan'
import { setBuilderAccount } from '@/lib/entitlements/entitlements'
import type { Database } from '@/lib/cloud/database.types'
import { isElectron } from '@/transport'

const log = createLogger('Auth')

export type { AuthProvider } from '@/lib/cloud/identities'
export type AuthStatus = 'unconfigured' | 'loading' | 'signed_out' | 'signed_in'
export type Profile = Database['public']['Tables']['users']['Row']
export type ProfileChanges = Partial<
    Pick<Profile, 'username' | 'display_name' | 'bio'>
>

export interface AuthUser {
    id: string
    email: string | null
    /** app_metadata.role = 'admin' (set by the service role only). */
    isAdmin: boolean
    /** aal2 once a second factor was verified this session. */
    aal: 'aal1' | 'aal2'
    /** The ways this account signs in (email, GitHub, …). */
    identities: LinkedIdentity[]
}

/** A TOTP factor being enrolled: show the QR (or the secret) and ask for a code. */
export interface TotpEnrollment {
    factorId: string
    qrCode: string
    secret: string
}

export interface AuthState {
    status: AuthStatus
    user: AuthUser | null
    profile: Profile | null
    /** Restore the session and start listening. Idempotent. */
    init: () => Promise<void>
    sendEmailCode: (email: string) => Promise<void>
    verifyEmailCode: (email: string, code: string) => Promise<void>
    /** Web: navigates away to the provider. Desktop: opens the system browser;
     *  the session lands later through completeWithCode. */
    signInWithProvider: (provider: AuthProvider) => Promise<void>
    /** Finish an OAuth sign-in or link with the code from the callback. */
    completeWithCode: (code: string) => Promise<void>
    /** The provider being linked to this account, while its browser round
     *  trip is open (desktop: until the code arrives or is pasted). */
    linking: AuthProvider | null
    /** Add a provider as another way into the signed-in account. Web:
     *  navigates away. Desktop: opens the system browser. */
    linkProvider: (provider: AuthProvider) => Promise<void>
    cancelLink: () => void
    /** Remove a sign-in method (not the last one). */
    unlinkIdentity: (identityId: string) => Promise<void>
    signOut: () => Promise<void>
    updateProfile: (changes: ProfileChanges) => Promise<void>
    refreshProfile: () => Promise<void>
    /** Start adding an authenticator app (admins need one for moderation). */
    enrollTotp: () => Promise<TotpEnrollment>
    /** The verified authenticator app, if any. */
    totpFactorId: () => Promise<string | null>
    /** Prove the second factor; the session becomes aal2. */
    verifyTotp: (factorId: string, code: string) => Promise<void>
}

interface IpcBridge {
    invoke(channel: string, ...args: unknown[]): Promise<unknown>
    on(event: string, cb: (...args: unknown[]) => void): () => void
}

function ipc(): IpcBridge | null {
    const api = (globalThis as { api?: IpcBridge }).api
    return api && typeof api.on === 'function' ? api : null
}

async function requireClient(): Promise<CloudClient> {
    const client = await getCloudClient()
    if (!client) throw new Error('Accounts are not available in this build')
    return client
}

/** The assurance level in the access token (aal1 when unreadable). */
function aalOf(accessToken: string): AuthUser['aal'] {
    try {
        const payload = accessToken.split('.')[1] ?? ''
        const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'))
        return (JSON.parse(json) as { aal?: string }).aal === 'aal2'
            ? 'aal2'
            : 'aal1'
    } catch {
        // A malformed token is treated as the weaker level.
        return 'aal1'
    }
}

function userOf(session: Session | null): AuthUser | null {
    if (!session) return null
    return {
        id: session.user.id,
        email: session.user.email ?? null,
        isAdmin: session.user.app_metadata?.role === 'admin',
        aal: aalOf(session.access_token),
        identities: identitiesOf(session.user),
    }
}

// The provider a link round trip is out for. Session storage, so the web
// app still knows after the provider sends the page back.
const LINKING_KEY = 'remappr.auth.linking'

function readLinking(): AuthProvider | null {
    try {
        return (sessionStorage.getItem(LINKING_KEY) as AuthProvider) || null
    } catch {
        return null
    }
}

function writeLinking(provider: AuthProvider | null): void {
    try {
        if (provider) sessionStorage.setItem(LINKING_KEY, provider)
        else sessionStorage.removeItem(LINKING_KEY)
    } catch {
        // Storage blocked: only the success toast is lost.
    }
}

const who = (u: AuthUser): string => u.email ?? 'another account'

/** A session that replaced another account's (a sign-in that arrived while
 *  signed in): say so, so nobody edits the wrong account unawares. */
function announceSwitch(before: AuthUser, after: AuthUser): void {
    toast.warning(`Switched account: now signed in as ${who(after)}`, {
        description: `You were signed in as ${who(before)}. To go back, sign out and sign in with that account.`,
        duration: 12000,
    })
}

// Accounts already told they are new, so a re-sent SIGNED_IN stays quiet.
const greeted = new Set<string>()

/** A provider sign-in that just made an account: it may be a second one. */
function announceNewAccount(session: Session): void {
    const { user } = session
    if (greeted.has(user.id) || !isNewProviderAccount(user)) return
    greeted.add(user.id)
    const provider = providerLabel(user.identities?.[0]?.provider ?? '')
    toast.info(`New Remappr account made with ${provider}`, {
        description: `Already have an account? Sign out, sign in with it, and link ${provider} under Account → Sign-in methods.`,
        duration: 15000,
    })
}

let started: Promise<void> | null = null

// The account last signed in here, kept until an explicit sign-out. Offline,
// an expired session cannot refresh and reads as signed out, yet a lifetime
// builder license must keep working: the builder gate counts this account.
const LAST_ACCOUNT_KEY = 'remappr.auth.lastAccount'

function rememberAccount(id: string | null): void {
    try {
        if (id) localStorage.setItem(LAST_ACCOUNT_KEY, id)
        else localStorage.removeItem(LAST_ACCOUNT_KEY)
    } catch {
        // Storage blocked: the gate then sees only the live session.
    }
}

function lastAccount(): string | null {
    try {
        return localStorage.getItem(LAST_ACCOUNT_KEY)
    } catch {
        return null
    }
}

// Whose plan was last read (undefined = none yet, null = signed out).
let planUser: string | null | undefined

const useAuthStore = create<AuthState>()((set, get) => {
    const applySession = (session: Session | null): void => {
        const user = userOf(session)
        const before = get().user
        if (before && user && before.id !== user.id)
            announceSwitch(before, user)
        if (user) rememberAccount(user.id)
        setBuilderAccount(user?.id ?? lastAccount())
        const changed = user?.id !== get().user?.id
        set({
            user,
            status: user ? 'signed_in' : 'signed_out',
            ...(changed ? { profile: null } : {}),
        })
        // auth-js holds a lock while this callback runs; calling back into it
        // synchronously would deadlock, so read the profile on the next tick.
        if (user && changed) setTimeout(() => void get().refreshProfile(), 0)
        const id = user?.id ?? null
        if (id === planUser) return
        planUser = id
        setTimeout(() => void refreshPlan(), 0)
    }

    const completeFromDeepLink = (code: string): void => {
        const linking = get().linking
        get()
            .completeWithCode(code)
            .then(() => {
                if (!linking) toast.success('Signed in')
            })
            .catch((e: unknown) => {
                log.error('deep-link sign-in failed', e)
                toast.error(
                    linking
                        ? cloudErrorMessage(e)
                        : 'Sign-in failed. Try again from Settings → Account.',
                )
            })
    }

    const listenForDesktopCallback = async (): Promise<void> => {
        const bridge = ipc()
        if (!bridge) return
        bridge.on(IpcEvents.AUTH_CALLBACK, (payload) => {
            const code = (payload as { code?: unknown })?.code
            if (typeof code === 'string') completeFromDeepLink(code)
        })
        const waiting = await bridge.invoke(IpcChannels.AUTH_TAKE_CALLBACK)
        if (typeof waiting === 'string') completeFromDeepLink(waiting)
    }

    const start = async (): Promise<void> => {
        const client = await getCloudClient()
        if (!client) {
            set({ status: 'unconfigured' })
            return
        }
        set({ status: 'loading' })
        client.auth.onAuthStateChange((event, session) => {
            // A real sign-out (not a refresh that failed offline) forgets the
            // account, so the builder asks to sign in again.
            if (event === 'SIGNED_OUT') rememberAccount(null)
            if (event === 'SIGNED_IN' && session) announceNewAccount(session)
            applySession(session)
        })
        const { data, error } = await client.auth.getSession()
        if (error) log.error('session restore failed', error)
        applySession(data.session)
        if (!isElectron()) {
            finishWebLink()
            stripAuthParams()
        }
        await listenForDesktopCallback()
    }

    /** A link the provider sent this page back from: say how it went. */
    const finishWebLink = (): void => {
        const refused = authRedirectError()
        const linking = readLinking()
        writeLinking(null)
        if (refused) {
            log.warn('OAuth came back refused', refused)
            toast.error(cloudErrorMessage(refused))
            return
        }
        const returned = new URL(window.location.href).searchParams.has('code')
        if (linking && returned) linked(linking)
    }

    const linked = (provider: AuthProvider): void => {
        toast.success(`${providerLabel(provider)} linked to your account`)
    }

    return {
        status: 'loading',
        user: null,
        profile: null,
        linking: null,
        init: () => {
            started ??= start().catch((e) => {
                log.error('auth init failed', e)
                set({ status: 'signed_out' })
            })
            return started
        },
        sendEmailCode: async (email) => {
            const client = await requireClient()
            const { error } = await client.auth.signInWithOtp({
                email,
                options: { shouldCreateUser: true },
            })
            if (error) throw error
        },
        verifyEmailCode: async (email, code) => {
            const client = await requireClient()
            const { error } = await client.auth.verifyOtp({
                email,
                token: code,
                type: 'email',
            })
            if (error) throw error
        },
        signInWithProvider: async (provider) => {
            const client = await requireClient()
            const electron = isElectron()
            const { data, error } = await client.auth.signInWithOAuth({
                provider,
                options: {
                    redirectTo: oauthRedirectTo(electron),
                    skipBrowserRedirect: electron,
                },
            })
            if (error) throw error
            // main forwards https window.open targets to the system browser.
            if (electron && data.url) window.open(data.url, '_blank')
        },
        completeWithCode: async (code) => {
            const client = await requireClient()
            const linking = get().linking
            const { error } = await client.auth.exchangeCodeForSession(code)
            if (linking) {
                writeLinking(null)
                set({ linking: null })
            }
            if (error) throw error
            if (linking) linked(linking)
        },
        linkProvider: async (provider) => {
            const client = await requireClient()
            const electron = isElectron()
            writeLinking(provider)
            set({ linking: provider })
            const { data, error } = await client.auth.linkIdentity({
                provider,
                options: {
                    redirectTo: oauthRedirectTo(electron),
                    skipBrowserRedirect: electron,
                },
            })
            if (error) {
                writeLinking(null)
                set({ linking: null })
                throw error
            }
            if (electron && data.url) window.open(data.url, '_blank')
        },
        cancelLink: () => {
            writeLinking(null)
            set({ linking: null })
        },
        unlinkIdentity: async (identityId) => {
            const client = await requireClient()
            const { data, error } = await client.auth.getUserIdentities()
            if (error) throw error
            const identity = data.identities.find(
                (i) => i.identity_id === identityId,
            )
            if (!identity) throw new Error('That sign-in method is gone.')
            const { error: unlinkError } =
                await client.auth.unlinkIdentity(identity)
            if (unlinkError) throw unlinkError
            // The session's user still lists it until the next token.
            const { error: refreshError } = await client.auth.refreshSession()
            if (refreshError) throw refreshError
        },
        signOut: async () => {
            const client = await requireClient()
            // This device only. The default (global) ends the account's
            // sessions everywhere, e.g. the browser that signed this app in.
            const { error } = await client.auth.signOut({ scope: 'local' })
            if (error) throw error
        },
        updateProfile: async (changes) => {
            const user = get().user
            if (!user) throw new Error('Not signed in')
            const client = await requireClient()
            const { data, error } = await client
                .from('users')
                .update(changes)
                .eq('id', user.id)
                .select()
                .single()
            if (error) throw error
            set({ profile: data })
        },
        refreshProfile: async () => {
            const user = get().user
            const client = await getCloudClient()
            if (!user || !client) return
            const { data, error } = await client
                .from('users')
                .select('*')
                .eq('id', user.id)
                .maybeSingle()
            if (error) {
                log.error('profile read failed', error)
                return
            }
            if (get().user?.id === user.id) set({ profile: data })
        },
        enrollTotp: async () => {
            const client = await requireClient()
            // An enrollment abandoned before its first code blocks a new one.
            const { data: factors, error: listError } =
                await client.auth.mfa.listFactors()
            if (listError) throw listError
            for (const f of factors.all.filter(
                (f) => f.status === 'unverified',
            ))
                await client.auth.mfa.unenroll({ factorId: f.id })
            const { data, error } = await client.auth.mfa.enroll({
                factorType: 'totp',
                friendlyName: `Remappr ${new Date().toISOString().slice(0, 10)}`,
            })
            if (error) throw error
            return {
                factorId: data.id,
                qrCode: data.totp.qr_code,
                secret: data.totp.secret,
            }
        },
        totpFactorId: async () => {
            const client = await requireClient()
            const { data, error } = await client.auth.mfa.listFactors()
            if (error) throw error
            return data.totp[0]?.id ?? null
        },
        verifyTotp: async (factorId, code) => {
            const client = await requireClient()
            const { error } = await client.auth.mfa.challengeAndVerify({
                factorId,
                code,
            })
            if (error) throw error
        },
    }
})

export default useAuthStore
