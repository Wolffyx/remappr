// Pattern check: Facade (Tier 1) — applied — single entry over GitHub Releases REST API used by 4+ call sites
// Pattern check: Strategy (Tier 1) — applied — per-platform asset matching rules swappable without touching consumers

import { GITHUB_OWNER, GITHUB_REPO } from '@/lib/constants'

export interface ReleaseAsset {
    name: string
    browser_download_url: string
    size: number
}

export interface Release {
    tag_name: string
    name: string
    html_url: string
    body: string
    published_at: string
    prerelease?: boolean
    draft?: boolean
    assets: ReleaseAsset[]
}

export type AppPlatform = 'win32' | 'darwin' | 'linux' | 'web' | 'unknown'

interface PlatformAssetStrategy {
    label: string
    match: (asset: ReleaseAsset) => boolean
}

const platformStrategies: Record<
    Exclude<AppPlatform, 'web' | 'unknown'>,
    PlatformAssetStrategy
> = {
    win32: {
        label: 'Windows',
        match: (a) => /\.(exe|msi)$/i.test(a.name),
    },
    darwin: {
        label: 'macOS',
        match: (a) => /\.dmg$/i.test(a.name),
    },
    linux: {
        label: 'Linux',
        match: (a) => /\.(AppImage|deb)$/i.test(a.name),
    },
}

// pattern-check: skip — module-level promise memoization, no abstraction
const RELEASES_LATEST = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`

let cachedReleasePromise: Promise<Release | null> | null = null

export async function getLatestRelease(): Promise<Release | null> {
    if (cachedReleasePromise) return cachedReleasePromise
    const promise = (async () => {
        try {
            const res = await fetch(RELEASES_LATEST, {
                headers: { Accept: 'application/vnd.github+json' },
            })
            if (!res.ok) return null
            return (await res.json()) as Release
        } catch {
            return null
        }
    })()
    cachedReleasePromise = promise
    promise.then((val) => {
        if (val === null && cachedReleasePromise === promise) {
            cachedReleasePromise = null
        }
    })
    return promise
}

// Pattern check: Facade (Tier 1) — extended — recent-releases read added to this GitHub Releases facade for the start-page news
const RELEASES_LIST = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases`

/** The newest `count` releases, newest first. Throws on a network or HTTP
 *  error so the caller can keep what it already has. */
export async function getRecentReleases(count: number): Promise<Release[]> {
    const res = await fetch(`${RELEASES_LIST}?per_page=${count}`, {
        headers: { Accept: 'application/vnd.github+json' },
    })
    if (!res.ok) throw new Error(`GitHub releases: HTTP ${res.status}`)
    return (await res.json()) as Release[]
}

export function getAssetForPlatform(
    release: Release,
    platform: AppPlatform,
): ReleaseAsset | null {
    if (platform === 'web' || platform === 'unknown') return null
    const strategy = platformStrategies[platform]
    return release.assets.find((a) => strategy.match(a)) ?? null
}

export function getPlatformLabel(platform: AppPlatform): string {
    if (platform === 'web' || platform === 'unknown') return 'your platform'
    return platformStrategies[platform].label
}

export function detectPlatform(): AppPlatform {
    const electronPlatform = (
        window as unknown as {
            electron?: { process?: { platform?: string } }
        }
    ).electron?.process?.platform
    if (electronPlatform === 'win32') return 'win32'
    if (electronPlatform === 'darwin') return 'darwin'
    if (electronPlatform === 'linux') return 'linux'

    if (typeof navigator === 'undefined') return 'unknown'
    const ua = navigator.userAgent
    if (/Windows/i.test(ua)) return 'win32'
    if (/Mac/i.test(ua)) return 'darwin'
    if (/Linux/i.test(ua)) return 'linux'
    return 'web'
}
