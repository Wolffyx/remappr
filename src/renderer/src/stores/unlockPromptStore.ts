// Pattern check: no GoF pattern (-) — rejected — a zustand UI-state slice plus one shared in-flight promise; mirrors the repo's other session stores.
import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import type { KeyboardService } from '@firmware/service'

/**
 * The unlock prompt for firmwares with an 'actions' lock (Vial): an operation
 * the board refuses while locked opens it, the user holds the combo the board
 * asks for, and the operation retries once the board unlocks. Session-only.
 */
interface UnlockPromptState {
    /** 'idle' = closed; 'failed' = open, waiting for Try again / Cancel. */
    status: 'idle' | 'unlocking' | 'failed'
    /** Physical-layout key indexes to hold, as the board reports them. */
    keys: number[]
    progress: number
    error: string | null
    cancel: () => void
    retry: () => void
}

interface Pending {
    service: KeyboardService
    promise: Promise<boolean>
    resolve: (unlocked: boolean) => void
    abort: AbortController | null
}

let pending: Pending | null = null

const useUnlockPromptStore = create<UnlockPromptState>()(
    devtools(
        () => ({
            status: 'idle',
            keys: [],
            progress: 0,
            error: null,
            cancel: () => finish(false),
            retry: () => {
                if (pending) void run(pending)
            },
        }),
        { name: 'unlockPrompt' },
    ),
)

function finish(unlocked: boolean): void {
    const p = pending
    if (!p) return
    pending = null
    p.abort?.abort()
    useUnlockPromptStore.setState({
        status: 'idle',
        keys: [],
        progress: 0,
        error: null,
    })
    p.resolve(unlocked)
}

async function run(p: Pending): Promise<void> {
    const abort = new AbortController()
    p.abort = abort
    useUnlockPromptStore.setState({
        status: 'unlocking',
        progress: 0,
        error: null,
    })
    try {
        await p.service.unlock({
            signal: abort.signal,
            onProgress: ({ keys, progress }) => {
                if (abort.signal.aborted) return
                useUnlockPromptStore.setState({ keys, progress })
            },
        })
        if (pending === p && !abort.signal.aborted) finish(true)
    } catch (err) {
        if (pending !== p || abort.signal.aborted) return
        useUnlockPromptStore.setState({
            status: 'failed',
            error: err instanceof Error ? err.message : String(err),
        })
    }
}

/**
 * Ask the user to unlock `service`. Resolves true once it is unlocked, false
 * if they cancel. Concurrent callers share the one prompt.
 */
export function requestUnlock(service: KeyboardService): Promise<boolean> {
    if (pending?.service === service) return pending.promise
    finish(false)
    let resolve!: (unlocked: boolean) => void
    const promise = new Promise<boolean>((r) => (resolve = r))
    pending = { service, promise, resolve, abort: null }
    void run(pending)
    return promise
}

/** Drop any open prompt (e.g. the device disconnected). */
export function dismissUnlockPrompt(): void {
    finish(false)
}

export default useUnlockPromptStore
