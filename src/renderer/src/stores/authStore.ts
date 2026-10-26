// Pattern check: no GoF pattern (-) — rejected — zustand store over supabase-js
// auth; the client comes from the getCloudClient seam (null → 'unconfigured').
//
// Accounts are optional. A build without a backend stays 'unconfigured' and
// nothing cloud renders. Sign-in is a 6-digit email code or an OAuth provider;
// on desktop the provider's code comes back over remappr:// (main/deep-link.ts)
// or is pasted from the bounce page.
import { create } from 'zustand'
import { toast } from 'sonner'
import type { Session } from '@supabase/supabase-js'
import { createLogger } from '@shared/logger'
import { IpcChannels, IpcEvents } from '@shared/ipc-types'
import { getCloudClient, type CloudClient } from '@/lib/cloud/client'
import { oauthRedirectTo, stripAuthParams } from '@/lib/cloud/authRedirect'
import type { Database } from '@/lib/cloud/database.types'
import { isElectron } from '@/transport'

const log = createLogger('Auth')

export type AuthProvider = 'github' | 'discord' | 'google'
export type AuthStatus = 'unconfigured' | 'loading' | 'signed_out' | 'signed_in'
export type Profile = Database['public']['Tables']['users']['Row']
export type ProfileChanges = Partial<
    Pick<Profile, 'username' | 'display_name' | 'bio'>
>

export interface AuthUser {
    id: string
    email: string | null
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
    /** Finish an OAuth sign-in with the code from the callback. */
    completeWithCode: (code: string) => Promise<void>
    signOut: () => Promise<void>
    updateProfile: (changes: ProfileChanges) => Promise<void>
    refreshProfile: () => Promise<void>
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

function userOf(session: Session | null): AuthUser | null {
    if (!session) return null
    return { id: session.user.id, email: session.user.email ?? null }
}

let started: Promise<void> | null = null

const useAuthStore = create<AuthState>()((set, get) => {
    const applySession = (session: Session | null): void => {
        const user = userOf(session)
        const changed = user?.id !== get().user?.id
        set({
            user,
            status: user ? 'signed_in' : 'signed_out',
            ...(changed ? { profile: null } : {}),
        })
        // auth-js holds a lock while this callback runs; calling back into it
        // synchronously would deadlock, so read the profile on the next tick.
        if (user && changed) setTimeout(() => void get().refreshProfile(), 0)
    }

    const completeFromDeepLink = (code: string): void => {
        get()
            .completeWithCode(code)
            .then(() => toast.success('Signed in'))
            .catch((e: unknown) => {
                log.error('deep-link sign-in failed', e)
                toast.error(
                    'Sign-in failed. Try again from Settings → Account.',
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
        client.auth.onAuthStateChange((_event, session) => {
            applySession(session)
        })
        const { data, error } = await client.auth.getSession()
        if (error) log.error('session restore failed', error)
        applySession(data.session)
        if (!isElectron()) stripAuthParams()
        await listenForDesktopCallback()
    }

    return {
        status: 'loading',
        user: null,
        profile: null,
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
            const { error } = await client.auth.exchangeCodeForSession(code)
            if (error) throw error
        },
        signOut: async () => {
            const client = await requireClient()
            const { error } = await client.auth.signOut()
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
    }
})

export default useAuthStore
