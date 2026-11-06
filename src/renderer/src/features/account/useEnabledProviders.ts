// pattern-check: skip — a React hook over lib/cloud/providers.
//
// The OAuth providers this backend has on, as AUTH_PROVIDERS entries; null
// while asking. A failed read offers none (no provider would work offline).
import { useEffect, useState } from 'react'
import { createLogger } from '@shared/logger'
import { AUTH_PROVIDERS } from '@/lib/cloud/identities'
import { enabledProviders } from '@/lib/cloud/providers'

const log = createLogger('Auth')

export type ProviderEntry = (typeof AUTH_PROVIDERS)[number]

export function useEnabledProviders(): readonly ProviderEntry[] | null {
    const [providers, setProviders] = useState<readonly ProviderEntry[] | null>(
        null,
    )
    useEffect(() => {
        let live = true
        enabledProviders()
            .then((ids) => AUTH_PROVIDERS.filter((p) => ids.includes(p.id)))
            .catch((e: unknown) => {
                log.warn('could not read the sign-in providers', e)
                return []
            })
            .then((list) => {
                if (live) setProviders(list)
            })
        return () => {
            live = false
        }
    }, [])
    return providers
}
