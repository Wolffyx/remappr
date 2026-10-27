// pattern-check: skip — wires three triggers to the shared delivery call.
//
// Builds that load the delivered builder fetch it in the background, so it is
// cached (and opens offline) before anyone clicks: shortly after start, when
// the connection comes back, and when the desktop app learns of an update.
// Packages for a newer host API arrive with that host; this keeps the newest
// package for the running one.
import { createLogger } from '@shared/logger'
import { IpcEvents } from '@shared/ipc-types'
import { isCloudConfigured } from '@/lib/cloud/env'
import { ensureBuilderPackageOnce } from './delivery'
import { builderSource } from './source'

const log = createLogger('BuilderPrefetch')
const START_DELAY_MS = 5000

interface IpcBridge {
    on(event: string, cb: (...args: unknown[]) => void): () => void
}

function prefetch(): void {
    ensureBuilderPackageOnce().catch((e: unknown) =>
        log.warn('builder prefetch failed', e),
    )
}

/** Start the background prefetch; returns a stop function. */
export function startBuilderPrefetch(): () => void {
    if (builderSource() !== 'delivered' || !isCloudConfigured())
        return () => undefined
    const timer = setTimeout(prefetch, START_DELAY_MS)
    window.addEventListener('online', prefetch)
    const api = (globalThis as { api?: IpcBridge }).api
    const offUpdate = api?.on(IpcEvents.UPDATE_AVAILABLE, prefetch)
    return () => {
        clearTimeout(timer)
        window.removeEventListener('online', prefetch)
        offUpdate?.()
    }
}
