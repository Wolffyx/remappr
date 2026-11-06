// Pattern check: Strategy (Tier 1) — applied — how GitHub's answer comes back
// differs by host (web: a popup posts it; desktop: the system browser hands it
// over on remappr://, or the user pastes it), behind one open/listen pair.
//
// Connect GitHub (Settings → Integrations, plan §6c A2): connect with the
// Remappr GitHub App, or, as the advanced fallback, a personal access token.
// Independent of the Remappr account.
import { create } from 'zustand'
import { IpcEvents } from '@shared/ipc-types'
import { getApi } from '@/electron/api'
import {
    authorizeUrl,
    githubAppConfig,
    githubCodeFromPaste,
    newPendingConnect,
    type PendingConnect,
} from '@/lib/github/appAuth'
import {
    completeAppConnect,
    disconnectApp,
    personalTokenAccount,
    readAppConnection,
    setPersonalToken,
    type GithubAccount,
} from '@/lib/github/connection'

export interface GithubState {
    status: 'loading' | 'disconnected' | 'connecting' | 'connected'
    via: 'app' | 'token' | null
    account: GithubAccount | null
    error: string | null
    init: () => Promise<void>
    /** Open GitHub's authorization; resolves once it is open. */
    connect: () => Promise<void>
    /** The code the user pasted (desktop installs without remappr://). */
    pasteCode: (text: string) => Promise<void>
    cancel: () => void
    disconnect: () => Promise<void>
    /** Keep a personal access token ('' removes it). */
    saveToken: (token: string) => Promise<void>
}

interface Answer {
    code: string
    state?: string
}

interface ReturnPath {
    open(url: string): void
    /** Start listening; returns the stop function. */
    listen(onAnswer: (a: Answer) => void): () => void
}

const isAnswer = (d: unknown): d is { code: string; state: string } =>
    !!d &&
    typeof (d as Answer).code === 'string' &&
    typeof (d as Answer).state === 'string'

const webPath: ReturnPath = {
    open: (url) => {
        window.open(url, 'remappr-github', 'popup,width=720,height=820')
    },
    listen: (onAnswer) => {
        const onMessage = (e: MessageEvent): void => {
            if (e.origin !== window.location.origin) return
            const d = e.data as { type?: string }
            if (d?.type === 'remappr:github' && isAnswer(d)) onAnswer(d)
        }
        window.addEventListener('message', onMessage)
        return () => window.removeEventListener('message', onMessage)
    },
}

const desktopPath: ReturnPath = {
    // Main forwards https window.open targets to the system browser.
    open: (url) => {
        window.open(url, '_blank')
    },
    listen: (onAnswer) =>
        getApi()?.on(IpcEvents.GITHUB_CALLBACK, (payload) => {
            if (isAnswer(payload)) onAnswer(payload)
        }) ?? (() => undefined),
}

const returnPath = (): ReturnPath => (getApi() ? desktopPath : webPath)

const message = (e: unknown): string =>
    e instanceof Error ? e.message : String(e)

let pending: PendingConnect | null = null
let stopListening: (() => void) | null = null

const useGithubStore = create<GithubState>()((set, get) => {
    const stop = (): void => {
        stopListening?.()
        stopListening = null
    }

    const finish = async ({ code, state }: Answer): Promise<void> => {
        const attempt = pending
        if (!attempt) return
        if (state !== undefined && state !== attempt.state) {
            set({ error: 'That answer belongs to another connect attempt.' })
            return
        }
        pending = null
        stop()
        try {
            const c = await completeAppConnect(code, attempt)
            set({
                status: 'connected',
                via: 'app',
                account: { login: c.login, avatarUrl: c.avatarUrl },
                error: null,
            })
        } catch (e) {
            set({ status: 'disconnected', error: message(e) })
        }
    }

    return {
        status: 'loading',
        via: null,
        account: null,
        error: null,

        init: async () => {
            const app = await readAppConnection()
            if (app) {
                set({
                    status: 'connected',
                    via: 'app',
                    account: { login: app.login, avatarUrl: app.avatarUrl },
                })
                return
            }
            const account = await personalTokenAccount()
            set({
                status: account ? 'connected' : 'disconnected',
                via: account ? 'token' : null,
                account,
            })
        },

        connect: async () => {
            const config = githubAppConfig()
            if (!config) return
            stop()
            pending = await newPendingConnect()
            const path = returnPath()
            stopListening = path.listen((a) => void finish(a))
            set({ status: 'connecting', error: null })
            path.open(authorizeUrl(config, pending))
        },

        pasteCode: async (text) => {
            const code = githubCodeFromPaste(text)
            if (!code) {
                set({ error: 'That is not a GitHub code.' })
                return
            }
            await finish({ code })
        },

        cancel: () => {
            pending = null
            stop()
            set({ status: get().account ? 'connected' : 'disconnected' })
        },

        disconnect: async () => {
            if (get().via === 'app') await disconnectApp()
            else await setPersonalToken('')
            set({ status: 'disconnected', via: null, account: null })
            // A personal token kept beside the app connection takes over.
            await get().init()
        },

        saveToken: async (token) => {
            try {
                const account = await setPersonalToken(token)
                set({
                    status: account ? 'connected' : 'disconnected',
                    via: account ? 'token' : null,
                    account,
                    error: null,
                })
            } catch (e) {
                set({ error: message(e) })
            }
        },
    }
})

export default useGithubStore
