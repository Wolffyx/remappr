// pattern-check: skip — effect-driven runtime lookup with banner UI; single caller
import { useEffect, useState } from 'react'
import { Loader2, X } from 'lucide-react'
import { toast } from 'sonner'

import type { KeyboardService } from '@firmware/service'
import type { SideloadStatus } from '@firmware/sideload'
import useConnectionStore from '@/stores/connectionStore'
import useKeymapStore from '@/stores/keymapStore'
import useUserSettingsStore from '@/stores/userSettingsStore'
import useLightingCatalogStore from '@/stores/lightingCatalogStore'
import { Button } from '@/ui/button'

const dbg = (...args: unknown[]): void => {
    if (import.meta.env.DEV) console.log('[AutoLayoutResolver]', ...args)
}

function statusLine(s: SideloadStatus): string {
    switch (s.phase) {
        case 'cache-hit':
            return 'Layout loaded from cache'
        case 'listing':
            return `Listing ${s.source}@${s.revision}…`
        case 'scanning':
            return `Scanning ${s.source}@${s.revision} (${s.processed}/${s.total})…`
        case 'hit':
            return `Found: ${s.name}`
        case 'applying':
            return `Applying ${s.name} (reading keymap)…`
        case 'miss':
            return 'No matching layout in registry'
        case 'error':
            return `Lookup error: ${s.message}`
    }
}

type RunPlan = { run: false; reason: string } | { run: true }

// Gated purely on the neutral facade: an adapter that can look itself up in a
// registry exposes `resolveAuto`. Which registry, and what identifies the board
// there, is the adapter's business — this component never sees a vid/pid.
function shouldRunAutoLayout(
    service: KeyboardService | null,
    autoLoadLayout: boolean,
): RunPlan {
    if (!service) return { run: false, reason: 'no service' }
    if (!service.sideload?.resolveAuto)
        return { run: false, reason: '!sideload.resolveAuto' }
    if (!autoLoadLayout)
        return { run: false, reason: 'autoLoadLayout disabled' }
    return { run: true }
}

function deviceKey(service: KeyboardService | null): string | null {
    if (!service) return null
    const { vid, pid } = service.deviceInfo
    if (vid === undefined || pid === undefined) return null
    return `${vid.toString(16)}:${pid.toString(16)}`
}

export function AutoLayoutResolver(): JSX.Element | null {
    const service = useConnectionStore((s) => s.service)
    const setKeymap = useKeymapStore((s) => s.setKeymap)
    const autoLoadLayout = useUserSettingsStore((s) => s.autoLoadLayout)
    const [status, setStatus] = useState<SideloadStatus | null>(null)
    const [done, setDone] = useState<'hit' | 'miss' | 'error' | null>(null)
    const [dismissedKey, setDismissedKey] = useState<string | null>(null)

    const currentKey = deviceKey(service)
    const dismissed = dismissedKey !== null && dismissedKey === currentKey

    useEffect(() => {
        const plan = shouldRunAutoLayout(service, autoLoadLayout)
        if (!plan.run) {
            dbg('skip:', plan.reason)
            if (!service) {
                /* eslint-disable react-hooks/set-state-in-effect */
                setStatus(null)
                setDone(null)
                setDismissedKey(null)
                /* eslint-enable react-hooks/set-state-in-effect */
            }
            return
        }
        const sideload = service!.sideload!
        dbg('running for', service!.deviceInfo.name)
        setStatus(null)
        setDone(null)

        // Something already cached for this device — nothing to look up.
        if (sideload.readCached?.()) {
            setStatus({ phase: 'cache-hit' })
            setDone('hit')
            return
        }

        let cancelled = false
        ;(async () => {
            try {
                const result = await sideload.resolveAuto!((s) => {
                    if (!cancelled) setStatus(s)
                })
                if (cancelled) return
                if (!result) {
                    setDone('miss')
                    return
                }
                if (result.lightingCatalog !== undefined)
                    useLightingCatalogStore
                        .getState()
                        .setCatalog(result.lightingCatalog)
                if (result.keymapChanged) setKeymap(await service!.getKeymap())
                setDone('hit')
                toast.success(`Layout loaded: ${result.name}`)
            } catch (err) {
                if (cancelled) return
                setDone('error')
                toast.error(`Failed to apply layout: ${(err as Error).message}`)
            }
        })()
        return () => {
            cancelled = true
        }
    }, [service, setKeymap, autoLoadLayout])

    if (!service?.sideload?.resolveAuto) return null
    if (dismissed) return null
    if (!status && !done) return null

    const isSearching = !done

    return (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 rounded-md border bg-card px-3 py-2 shadow-md text-sm">
            {isSearching ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : null}
            <span>
                {done === 'miss'
                    ? 'No layout found in registry. Use “Load layout JSON” to upload.'
                    : done === 'error'
                      ? 'Layout lookup failed. Try uploading manually.'
                      : (status && statusLine(status)) || 'Searching…'}
            </span>
            {!isSearching ? (
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={(): void => setDismissedKey(currentKey)}
                    aria-label="Dismiss"
                    className="h-6 w-6"
                >
                    <X className="h-4 w-4" />
                </Button>
            ) : null}
        </div>
    )
}
