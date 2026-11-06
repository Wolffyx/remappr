// pattern-check: skip — pure mappers from Supabase identities to the words
// the account screens show, plus the checks around a new or switched account.
//
// One Remappr account can have several ways to sign in (identities): the email
// code, GitHub, Discord, Google. Signing in with a provider the account has
// not linked makes a second, empty account unless the provider shares the
// account's verified email, so the app offers to link instead.
import type { User, UserIdentity } from '@supabase/supabase-js'

export type AuthProvider = 'github' | 'discord' | 'google'

export const AUTH_PROVIDERS: readonly { id: AuthProvider; label: string }[] = [
    { id: 'github', label: 'GitHub' },
    { id: 'discord', label: 'Discord' },
    { id: 'google', label: 'Google' },
]

export interface LinkedIdentity {
    /** identity_id, what unlinking takes. */
    id: string
    provider: string
    /** The account on the provider: @login, a name or an email. */
    label: string
}

type IdentityData = Record<string, unknown>

const text = (v: unknown): string | null =>
    typeof v === 'string' && v.trim() ? v.trim() : null

/** The provider's account in words: GitHub's login, else a name or email. */
export function identityLabel(
    identity: Pick<UserIdentity, 'identity_data'>,
): string {
    const d: IdentityData = identity.identity_data ?? {}
    const login = text(d.user_name) ?? text(d.preferred_username)
    if (login) return `@${login}`
    return text(d.email) ?? text(d.full_name) ?? text(d.name) ?? ''
}

export function identitiesOf(user: Pick<User, 'identities'>): LinkedIdentity[] {
    return (user.identities ?? []).map((i) => ({
        id: i.identity_id,
        provider: i.provider,
        label: identityLabel(i),
    }))
}

/** The GitHub login an account signs in with, without the @. */
export function githubLoginOf(
    identities: readonly LinkedIdentity[],
): string | null {
    const github = identities.find((i) => i.provider === 'github')
    return github?.label.replace(/^@/, '') || null
}

const NEW_ACCOUNT_MS = 2 * 60 * 1000

/** An account a provider sign-in made just now (its only identity is that
 *  provider): the moment to say a new account exists. */
export function isNewProviderAccount(
    user: Pick<User, 'created_at' | 'identities'>,
    now: number = Date.now(),
): boolean {
    const identities = user.identities ?? []
    if (identities.length !== 1 || identities[0].provider === 'email')
        return false
    const created = Date.parse(user.created_at)
    return Number.isFinite(created) && now - created < NEW_ACCOUNT_MS
}

export function providerLabel(provider: string): string {
    if (provider === 'email') return 'Email'
    return AUTH_PROVIDERS.find((p) => p.id === provider)?.label ?? provider
}

export type GithubLinkVerdict =
    /** Nothing to say: no connect just now, or nobody signed in. */
    | 'none'
    /** Signed in without GitHub: offer to link the connected login. */
    | 'ask'
    /** The account already signs in with this GitHub login. */
    | 'same'
    /** The account signs in with another GitHub login. */
    | 'other'

/** What a fresh Connect GitHub means for the signed-in Remappr account. */
export function githubLinkVerdict(
    connected: string | null,
    signedIn: boolean,
    linkedLogin: string | null,
): GithubLinkVerdict {
    if (!connected || !signedIn) return 'none'
    if (!linkedLogin) return 'ask'
    return linkedLogin.toLowerCase() === connected.toLowerCase()
        ? 'same'
        : 'other'
}
