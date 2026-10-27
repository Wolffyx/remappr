// Pattern check: no GoF pattern (-) — rejected — sequencing over the injected
// PackageStore (the Strategy lives in ./stores); one caller (./source).
//
// Getting the builder to this device: use the newest cached package this host
// can run; when online, ask get-package for a newer one (with this device's
// license once the builder is paid), verify it and keep it. A revoked license
// drops the license and every cached package. Offline, the cached one is used.
import { createLogger } from '@shared/logger'
import { compareVersions } from '@shared/builderPackage'
import { getCloudClient } from '@/lib/cloud/client'
import { cloudErrorMessage } from '@/lib/cloud/errors'
import { getSecret } from '@/lib/secretStore'
import type { BuilderPackage } from './loader'
import { loadSignedPackage } from './loader'
import { HOST_API } from './hostModules'
import { packageStore, type PackageStore, type StoredPackage } from './stores'

const log = createLogger('BuilderPackage')
const LICENSE_KEY = 'builderLicense'
const SEED_PATH = '_seed/builder.json'

interface DeliveryReply {
    manifest?: string
    signature?: string
    kid?: string
    files?: Record<string, string>
}

function newest(packages: readonly StoredPackage[]): StoredPackage | null {
    const runnable = packages.filter((p) => p.hostApi === `^${HOST_API}`)
    return (
        runnable.sort((a, b) => compareVersions(b.version, a.version))[0] ??
        null
    )
}

/** The newest stable version published for this host, or null. */
async function publishedVersion(): Promise<string | null> {
    const client = await getCloudClient()
    if (!client) return null
    const { data, error } = await client
        .from('builder_packages')
        .select('version')
        .eq('channel', 'stable')
        .eq('host_api', `^${HOST_API}`)
        .order('published_at', { ascending: false })
        .limit(1)
    if (error) throw error
    return data[0]?.version ?? null
}

async function errorCode(error: unknown): Promise<string> {
    const response = (error as { context?: Response }).context
    const body = (await response?.json?.().catch(() => null)) as {
        error?: string
    } | null
    return body?.error ?? cloudErrorMessage(error)
}

/** Fetch and keep the newest package; null when this host has none newer. */
async function download(
    store: PackageStore,
    have: string | null,
): Promise<StoredPackage | null> {
    const latest = await publishedVersion()
    if (!latest || (have && compareVersions(latest, have) <= 0)) return null
    const client = await getCloudClient()
    if (!client) return null
    const license = (await getSecret(LICENSE_KEY)) || undefined
    const { data, error } = await client.functions.invoke<DeliveryReply>(
        'get-package',
        {
            body: { hostApi: HOST_API, license },
        },
    )
    if (error) {
        const code = await errorCode(error)
        if (code === 'license_revoked') await dropAll(store)
        throw new Error(code)
    }
    if (!data?.manifest || !data.signature || !data.kid || !data.files)
        throw new Error('empty package reply')
    return store.store(
        { manifest: data.manifest, signature: data.signature, kid: data.kid },
        data.files,
    )
}

/** A revoked license: forget the license and every cached package. */
async function dropAll(store: PackageStore): Promise<void> {
    const { default: useLicenseStore } = await import('@/stores/licenseStore')
    await useLicenseStore.getState().clear()
    for (const p of await store.list()) await store.remove(p.version)
}

/** The seed shipped with free-stage builds (public/_seed/builder.json, see
 *  scripts/fetch-builder-seed.cjs): kept like any delivered package, so the
 *  first run needs no download. Null when this build has none. */
async function installSeed(store: PackageStore): Promise<StoredPackage | null> {
    if (typeof document === 'undefined') return null
    const res = await fetch(new URL(SEED_PATH, document.baseURI)).catch(
        () => null,
    )
    if (!res?.ok || !res.headers.get('Content-Type')?.includes('json'))
        return null
    const seed = (await res.json()) as DeliveryReply
    if (!seed.manifest || !seed.signature || !seed.kid || !seed.files)
        return null
    try {
        const stored = await store.store(
            {
                manifest: seed.manifest,
                signature: seed.signature,
                kid: seed.kid,
            },
            seed.files,
        )
        return stored.hostApi === `^${HOST_API}` ? stored : null
    } catch (e) {
        log.warn('the bundled builder seed does not verify', e)
        return null
    }
}

/** The version to load: refreshed when online, cached otherwise. */
export async function ensureBuilderPackage(
    store: PackageStore = packageStore(),
): Promise<string> {
    const cached = newest(await store.list()) ?? (await installSeed(store))
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
        if (cached) return cached.version
        throw new Error(
            'The builder has not been downloaded on this device yet; connect once to get it.',
        )
    }
    try {
        const fresh = await download(store, cached?.version ?? null)
        if (fresh) return fresh.version
    } catch (e) {
        if (!cached) throw e
        log.warn('builder update failed; using the cached one', e)
    }
    if (!cached)
        throw new Error(
            'No builder package is published for this app version yet.',
        )
    return cached.version
}

let inFlight: Promise<string> | null = null

/** ensureBuilderPackage on the default store, shared by concurrent callers
 *  (a background prefetch and opening the builder never download twice). */
export function ensureBuilderPackageOnce(): Promise<string> {
    inFlight ??= ensureBuilderPackage().finally(() => {
        inFlight = null
    })
    return inFlight
}

export async function loadDeliveredBuilder(
    given?: PackageStore,
): Promise<BuilderPackage> {
    const store = given ?? packageStore()
    const version = await (given
        ? ensureBuilderPackage(given)
        : ensureBuilderPackageOnce())
    await store.prepare()
    try {
        return await loadSignedPackage(store.baseUrl(version))
    } catch (e) {
        // A cached copy that no longer checks out (changed on disk, half
        // written) is dropped and fetched again, once.
        log.warn(`builder ${version} failed its check; fetching it again`, e)
        await store.remove(version)
        const again = await ensureBuilderPackage(store)
        return loadSignedPackage(store.baseUrl(again))
    }
}
