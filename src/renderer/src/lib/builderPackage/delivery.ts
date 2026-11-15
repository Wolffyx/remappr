// Pattern check: no GoF pattern (-) — rejected — sequencing over the injected
// PackageStore (the Strategy lives in ./stores); one caller (./source).
//
// Getting the builder to this device: use the newest cached package this host
// can run; when online, ask get-package for a newer one on this device's
// channel (with this device's license once the builder is paid), verify it,
// keep it and announce it (./updates). A builder only a newer app can run is
// announced too. A revoked license
// drops the license and every cached package. Offline, the cached one is used.
import { createLogger } from '@shared/logger'
import { compareVersions } from '@shared/builderPackage'
import { getCloudClient } from '@/lib/cloud/client'
import { cloudErrorMessage } from '@/lib/cloud/errors'
import { getSecret } from '@/lib/secretStore'
import { isBuilderFree } from '@/lib/entitlements/entitlements'
import type { BuilderPackage } from './loader'
import { loadSignedPackage } from './loader'
import { HOST_API } from './hostModules'
import { packageStore, type PackageStore, type StoredPackage } from './stores'
import { announceBuilderUpdate } from './updates'
import useUserSettingsStore, {
    type BuilderChannel,
} from '@/stores/userSettingsStore'

const log = createLogger('BuilderPackage')
const LICENSE_KEY = 'builderLicense'
const SEED_PATH = '_seed/builder.json'
const FREE_LICENSEE = 'free'

interface DeliveryReply {
    manifest?: string
    signature?: string
    kid?: string
    files?: Record<string, string>
}

/** The newest package this host can run. Once the builder is paid, copies
 *  from the free stage (the seed, earlier downloads) no longer count: the
 *  licensed copy is fetched instead. */
function newest(packages: readonly StoredPackage[]): StoredPackage | null {
    const free = isBuilderFree()
    const runnable = packages.filter(
        (p) =>
            p.hostApi === `^${HOST_API}` &&
            (free || p.licensee !== FREE_LICENSEE),
    )
    return (
        runnable.sort((a, b) => compareVersions(b.version, a.version))[0] ??
        null
    )
}

interface PublishedPackage {
    version: string
    host_api: string
    changelog: string
}

/** The channels this device takes packages from (Settings → About). */
function channels(): BuilderChannel[] {
    return useUserSettingsStore.getState().builderChannel === 'beta'
        ? ['stable', 'beta']
        : ['stable']
}

/** Every package published on this device's channels (a public read). */
async function published(): Promise<PublishedPackage[]> {
    const client = await getCloudClient()
    if (!client) return []
    const { data, error } = await client
        .from('builder_packages')
        .select('version, host_api, changelog')
        .in('channel', channels())
    if (error) throw error
    return data
}

function newestOf(rows: readonly PublishedPackage[]): PublishedPackage | null {
    return (
        [...rows].sort((a, b) => compareVersions(b.version, a.version))[0] ??
        null
    )
}

const hostMajor = (range: string): number => Number(range.replace(/^\^/, ''))

/** A builder newer than the one here that only a newer app can run. */
function announceNewerHost(
    rows: readonly PublishedPackage[],
    have: string | null,
): void {
    const ahead = newestOf(rows.filter((r) => hostMajor(r.host_api) > HOST_API))
    if (!ahead || (have && compareVersions(ahead.version, have) <= 0)) return
    announceBuilderUpdate({ kind: 'needs-host', version: ahead.version })
}

async function errorCode(error: unknown): Promise<string> {
    const response = (error as { context?: Response }).context
    const body = (await response?.json?.().catch(() => null)) as {
        error?: string
    } | null
    return body?.error ?? cloudErrorMessage(error)
}

/** Fetch and keep the newest package; null when this host has none newer.
 *  A download that replaces a cached builder is announced (with its notes). */
async function download(
    store: PackageStore,
    have: string | null,
): Promise<StoredPackage | null> {
    const rows = await published()
    announceNewerHost(rows, have)
    const latest = newestOf(rows.filter((r) => r.host_api === `^${HOST_API}`))
    if (!latest || (have && compareVersions(latest.version, have) <= 0))
        return null
    const client = await getCloudClient()
    if (!client) return null
    const license = (await getSecret(LICENSE_KEY)) || undefined
    const { data, error } = await client.functions.invoke<DeliveryReply>(
        'get-package',
        {
            body: {
                hostApi: HOST_API,
                license,
                version: latest.version,
                channel: useUserSettingsStore.getState().builderChannel,
            },
        },
    )
    if (error) {
        const code = await errorCode(error)
        if (code === 'license_revoked') await dropAll(store)
        throw new Error(code)
    }
    if (!data?.manifest || !data.signature || !data.kid || !data.files)
        throw new Error('empty package reply')
    const stored = await store.store(
        { manifest: data.manifest, signature: data.signature, kid: data.kid },
        data.files,
    )
    if (have)
        announceBuilderUpdate({
            kind: 'ready',
            version: stored.version,
            changelog: latest.changelog,
        })
    return stored
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
        return newest([stored])
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
