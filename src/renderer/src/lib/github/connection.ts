// pattern-check: skip — side effects of Connect GitHub: the secret store, the
// github-oauth Edge Function and GitHub's user endpoint.
//
// The GitHub connection this device holds: the GitHub App's user tokens
// (preferred) or, as the advanced fallback, a personal access token. Both
// live in the secret store (Electron safeStorage; localStorage on the web).
// getGithubToken() is what GitHub features call: it refreshes the app token
// when it is about to run out.
import { createLogger } from '@shared/logger'
import { getCloudClient } from '@/lib/cloud/client'
import { cloudErrorMessage } from '@/lib/cloud/errors'
import { getSecret, GITHUB_TOKEN_KEY, setSecret } from '@/lib/secretStore'
import {
    freshness,
    tokensFromReply,
    type GithubTokens,
    type PendingConnect,
} from './appAuth'

const log = createLogger('GitHub')
const APP_KEY = 'githubApp'
const API = 'https://api.github.com'

export interface GithubAccount {
    login: string
    avatarUrl: string | null
}

export type AppConnection = GithubTokens & GithubAccount

export async function readAppConnection(): Promise<AppConnection | null> {
    const raw = await getSecret(APP_KEY)
    if (!raw) return null
    try {
        return JSON.parse(raw) as AppConnection
    } catch {
        // A damaged entry: treat as not connected (the user connects again).
        log.warn('stored GitHub connection is unreadable; dropping it')
        await setSecret(APP_KEY, '')
        return null
    }
}

const writeAppConnection = (c: AppConnection | null): Promise<void> =>
    setSecret(APP_KEY, c ? JSON.stringify(c) : '')

/** A refusal from github-oauth, with GitHub's error code. */
export class GithubOauthError extends Error {
    constructor(
        readonly code: string,
        message: string,
    ) {
        super(message)
        this.name = 'GithubOauthError'
    }
}

async function oauthError(error: unknown): Promise<GithubOauthError> {
    const response = (error as { context?: Response }).context
    const body = (await response?.json?.().catch(() => null)) as {
        error?: string
        description?: string
    } | null
    const code = body?.error ?? 'request_failed'
    return new GithubOauthError(
        code,
        body?.description ?? body?.error ?? cloudErrorMessage(error),
    )
}

/** Ask github-oauth (it holds the app's client secret). */
async function oauth(body: Record<string, string>): Promise<unknown> {
    const client = await getCloudClient()
    if (!client) throw new Error('Connecting GitHub needs the Remappr backend.')
    const { data, error } = await client.functions.invoke('github-oauth', {
        body,
    })
    if (error) throw await oauthError(error)
    return data
}

/** The GitHub account a token belongs to. */
export async function fetchGithubAccount(
    token: string,
): Promise<GithubAccount> {
    const res = await fetch(`${API}/user`, {
        headers: {
            Accept: 'application/vnd.github+json',
            Authorization: `Bearer ${token}`,
            'X-GitHub-Api-Version': '2022-11-28',
        },
    })
    if (res.status === 401) throw new Error('GitHub did not accept the token.')
    if (!res.ok) throw new Error(`GitHub answered ${res.status}.`)
    const user = (await res.json()) as { login: string; avatar_url?: string }
    return { login: user.login, avatarUrl: user.avatar_url ?? null }
}

/** Finish a connect: swap the code for tokens and keep them. */
export async function completeAppConnect(
    code: string,
    pending: PendingConnect,
): Promise<AppConnection> {
    const reply = await oauth({
        action: 'exchange',
        code,
        redirectUri: pending.redirectUri,
        codeVerifier: pending.verifier,
    })
    const tokens = tokensFromReply(reply as Record<string, unknown>)
    if (!tokens) throw new Error('GitHub sent no token.')
    const account = await fetchGithubAccount(tokens.accessToken)
    const connection = { ...tokens, ...account }
    await writeAppConnection(connection)
    return connection
}

let refreshing: Promise<string | null> | null = null

async function refresh(c: AppConnection): Promise<string | null> {
    try {
        const reply = await oauth({
            action: 'refresh',
            refreshToken: c.refreshToken ?? '',
        })
        const tokens = tokensFromReply(reply as Record<string, unknown>)
        if (!tokens) throw new Error('GitHub sent no token.')
        await writeAppConnection({ ...c, ...tokens })
        return tokens.accessToken
    } catch (e) {
        // A refresh GitHub refuses (revoked, app uninstalled) ends the
        // connection; anything else (offline) keeps it for the next try.
        log.warn('GitHub token refresh failed', e)
        if (e instanceof GithubOauthError && e.code === 'bad_refresh_token')
            await writeAppConnection(null)
        return null
    }
}

/** The app connection's access token, refreshed when needed; null when
 *  there is none or it can no longer be renewed. */
async function appToken(): Promise<string | null> {
    const c = await readAppConnection()
    if (!c) return null
    const state = freshness(c)
    if (state === 'fresh') return c.accessToken
    if (state === 'expired') {
        await writeAppConnection(null)
        return null
    }
    refreshing ??= refresh(c).finally(() => {
        refreshing = null
    })
    return refreshing
}

/** The token GitHub features use: the app's, else a personal access token. */
export async function getGithubToken(): Promise<string | null> {
    return (await appToken()) ?? ((await getSecret(GITHUB_TOKEN_KEY)) || null)
}

/** Forget the app connection here and revoke it on GitHub (best effort). */
export async function disconnectApp(): Promise<void> {
    const c = await readAppConnection()
    await writeAppConnection(null)
    if (!c) return
    await oauth({ action: 'revoke', accessToken: c.accessToken }).catch(
        (e: unknown) =>
            log.warn('could not revoke the GitHub authorization', e),
    )
}

/** Keep a personal access token after checking it works; '' removes it. */
export async function setPersonalToken(
    token: string,
): Promise<GithubAccount | null> {
    const trimmed = token.trim()
    if (!trimmed) {
        await setSecret(GITHUB_TOKEN_KEY, '')
        return null
    }
    const account = await fetchGithubAccount(trimmed)
    await setSecret(GITHUB_TOKEN_KEY, trimmed)
    return account
}

export async function personalTokenAccount(): Promise<GithubAccount | null> {
    const token = await getSecret(GITHUB_TOKEN_KEY)
    if (!token) return null
    return fetchGithubAccount(token).catch(() => null)
}
