// pattern-check: skip — picks where the builder component comes from.
//
// The builder is bundled with the app today. In a dev build, setting
// localStorage `remappr.builder.packageUrl` to a package folder (e.g.
// "/_pkg/builder/0.1.0/", see `pnpm builder:package`) loads the delivered
// package instead, to try it against the live app. VITE_BUILDER_SOURCE=delivered
// (or, in dev, localStorage `remappr.builder.source` = "delivered") gets it from
// get-package: licensed, verified, cached for offline use.
import type { ComponentType } from 'react'
import { loadDeliveredBuilder } from './delivery'
import { loadBuilderPackage } from './loader'

const DEV_PACKAGE_KEY = 'remappr.builder.packageUrl'
const DEV_SOURCE_KEY = 'remappr.builder.source'

/** Delivered (licensed, cached, offline) when the build says so, or in dev
 *  when localStorage `remappr.builder.source` is "delivered". */
function wantsDelivered(): boolean {
    if (import.meta.env.VITE_BUILDER_SOURCE === 'delivered') return true
    if (!import.meta.env.DEV) return false
    try {
        return localStorage.getItem(DEV_SOURCE_KEY) === 'delivered'
    } catch {
        // Storage blocked: use the bundled builder.
        return false
    }
}

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
    if (wantsDelivered())
        return { default: (await loadDeliveredBuilder()).BuilderRoot }
    const url = devPackageUrl()
    if (url) return { default: (await loadBuilderPackage(url)).BuilderRoot }
    const m = await import('@/features/builder')
    return { default: m.Builder }
}
