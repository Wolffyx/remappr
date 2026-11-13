// pattern-check: skip — registers the app-shell service worker and wires the
// "update ready" prompt; web production builds only.
//
// The web app's service worker (built by scripts/pwa.ts) makes it work
// offline. A new version installs in the background and waits; before
// offering it, the delivered builder package is refreshed too (so the new
// version opens the builder offline), then a toast offers to reload.
import { toast } from 'sonner'
import { createLogger } from '@shared/logger'
import { isElectron } from '@/transport'

const log = createLogger('PWA')
const SW_URL = '/pkg-sw.js'

async function prefetchBuilder(): Promise<void> {
    const { builderSource } = await import('@/lib/builderPackage/source')
    if (builderSource() !== 'delivered') return
    const { ensureBuilderPackageOnce } =
        await import('@/lib/builderPackage/delivery')
    await ensureBuilderPackageOnce().catch((e: unknown) =>
        log.warn('builder prefetch before update failed', e),
    )
}

function offerUpdate(waiting: ServiceWorker): void {
    void prefetchBuilder().then(() =>
        toast.info('A new version of Remappr is ready', {
            duration: Infinity,
            action: {
                label: 'Reload',
                onClick: () => {
                    navigator.serviceWorker.addEventListener(
                        'controllerchange',
                        () => location.reload(),
                        {
                            once: true,
                        },
                    )
                    waiting.postMessage('SKIP_WAITING')
                },
            },
        }),
    )
}

export function registerAppShell(): void {
    if (
        !import.meta.env.PROD ||
        isElectron() ||
        !('serviceWorker' in navigator)
    )
        return
    navigator.serviceWorker
        .register(SW_URL, { scope: '/' })
        .then((reg) => {
            // Only an update (a controller already exists) is worth a prompt.
            if (reg.waiting && navigator.serviceWorker.controller)
                offerUpdate(reg.waiting)
            reg.addEventListener('updatefound', () => {
                const next = reg.installing
                next?.addEventListener('statechange', () => {
                    if (
                        next.state === 'installed' &&
                        navigator.serviceWorker.controller
                    )
                        offerUpdate(next)
                })
            })
        })
        .catch((e: unknown) =>
            log.warn('service worker registration failed', e),
        )
}
