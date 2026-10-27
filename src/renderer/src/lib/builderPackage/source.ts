// Pattern check: Dispatch Map (Tier 0) — applied — one decision (where the
// builder comes from) and a loader per source; prefetch reads the same decision.
//
// Where the builder component comes from:
// - "bundled": compiled into this app (dev builds, the default).
// - "delivered": the licensed, signed package from get-package, cached for
//   offline use. Builds made with REMAPPR_BUILDER=package carry only a stub of
//   the builder, so they always use this; VITE_BUILDER_SOURCE=delivered or, in
//   dev, localStorage `remappr.builder.source` = "delivered" choose it too.
// - "dev-package": in dev, localStorage `remappr.builder.packageUrl` pointing
//   at an unsigned package folder (see `pnpm builder:package`).
import type { ComponentType } from 'react'
import { loadDeliveredBuilder } from './delivery'
import { loadBuilderPackage } from './loader'

export type BuilderSource = 'bundled' | 'delivered' | 'dev-package'

const DEV_PACKAGE_KEY = 'remappr.builder.packageUrl'
const DEV_SOURCE_KEY = 'remappr.builder.source'

function devSetting(key: string): string | null {
    if (!import.meta.env.DEV) return null
    try {
        return localStorage.getItem(key)
    } catch {
        // Storage blocked: no dev override.
        return null
    }
}

/** The configured source; a build whose bundle is only the stub
 *  (REMAPPR_BUILDER=package) turns "bundled" into "delivered" at load time. */
export function builderSource(): BuilderSource {
    if (import.meta.env.VITE_BUILDER_SOURCE === 'delivered') return 'delivered'
    if (devSetting(DEV_SOURCE_KEY) === 'delivered') return 'delivered'
    if (devSetting(DEV_PACKAGE_KEY)) return 'dev-package'
    return 'bundled'
}

type Loaded = { default: ComponentType }

const LOADERS: Record<BuilderSource, () => Promise<Loaded>> = {
    delivered: async () => ({
        default: (await loadDeliveredBuilder()).BuilderRoot,
    }),
    'dev-package': async () => ({
        default: (await loadBuilderPackage(devSetting(DEV_PACKAGE_KEY) ?? ''))
            .BuilderRoot,
    }),
    bundled: async () => {
        const m = (await import('@/features/builder')) as {
            Builder: ComponentType
            BUILDER_STUB?: boolean
        }
        if (m.BUILDER_STUB) return LOADERS.delivered()
        return { default: m.Builder }
    },
}

export async function loadBuilderComponent(): Promise<Loaded> {
    return LOADERS[builderSource()]()
}
