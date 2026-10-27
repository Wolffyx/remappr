// pattern-check: skip — picks where the builder component comes from.
//
// The builder is bundled with the app today. In a dev build, setting
// localStorage `remappr.builder.packageUrl` to a package folder (e.g.
// "/_pkg/builder/0.1.0/", see `pnpm builder:package`) loads the delivered
// package instead, to try it against the live app. Delivery to users (licensed,
// cached, offline) replaces this switch in a later step.
import type { ComponentType } from 'react'
import { loadBuilderPackage } from './loader'

const DEV_PACKAGE_KEY = 'remappr.builder.packageUrl'

function devPackageUrl(): string | null {
    if (!import.meta.env.DEV) return null
    try {
        return localStorage.getItem(DEV_PACKAGE_KEY)
    } catch {
        // Storage blocked: use the bundled builder.
        return null
    }
}

export async function loadBuilderComponent(): Promise<{
    default: ComponentType
}> {
    const url = devPackageUrl()
    if (url) return { default: (await loadBuilderPackage(url)).BuilderRoot }
    const m = await import('@/features/builder')
    return { default: m.Builder }
}
