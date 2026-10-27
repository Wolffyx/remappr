// Pattern check: Strategy (Tier 1) — applied — one PackageStore contract, a web
// implementation (Cache Storage served by a service worker) and a desktop one
// (main process folder served over remappr-pkg://).
//
// Where verified builder packages are kept so the builder opens offline.
// Both serve a package at a base URL the loader imports from: same-origin
// /_pkg/builder/<ver>/ on the web, remappr-pkg://builder/<ver>/ on desktop.
import { IpcChannels } from '@shared/ipc-types'
import {
    decodeBase64,
    fileMatches,
    verifySignedManifest,
    type PackageSignature,
} from '@shared/builderPackage'
import { isElectron } from '@/transport'

export interface StoredPackage {
    version: string
    hostApi: string
}

export interface PackageStore {
    /** Make the base URLs servable (web: the service worker controls the page). */
    prepare(): Promise<void>
    list(): Promise<StoredPackage[]>
    /** Verify and keep a package; throws when anything does not check out. */
    store(
        signed: PackageSignature,
        files: Record<string, string>,
    ): Promise<StoredPackage>
    remove(version: string): Promise<void>
    baseUrl(version: string): string
}

const CACHE = 'remappr-pkg-v1'
const WEB_ROOT = '/_pkg/builder/'
const SIGNED = 'signed.json'
const SW_URL = '/pkg-sw.js'
const TYPES: Record<string, string> = {
    '.mjs': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
}

const dev = import.meta.env.DEV

function typeOf(path: string): string {
    return (
        TYPES[path.slice(path.lastIndexOf('.'))] ?? 'application/octet-stream'
    )
}

async function controlled(): Promise<void> {
    await navigator.serviceWorker.register(SW_URL, { scope: '/' })
    await navigator.serviceWorker.ready
    if (navigator.serviceWorker.controller) return
    await new Promise<void>((resolve) =>
        navigator.serviceWorker.addEventListener(
            'controllerchange',
            () => resolve(),
            { once: true },
        ),
    )
}

export function createWebPackageStore(): PackageStore {
    return {
        prepare: controlled,
        async list() {
            const cache = await caches.open(CACHE)
            const signedKeys = (await cache.keys())
                .map((r) => new URL(r.url).pathname)
                .filter(
                    (p) => p.startsWith(WEB_ROOT) && p.endsWith(`/${SIGNED}`),
                )
            const found = await Promise.all(
                signedKeys.map(async (path) => {
                    const res = await cache.match(path)
                    const manifest = res
                        ? verifySignedManifest(
                              (await res.json()) as PackageSignature,
                              dev,
                          )
                        : null
                    return manifest
                        ? {
                              version: manifest.version,
                              hostApi: manifest.hostApi,
                          }
                        : null
                }),
            )
            return found.filter((p): p is StoredPackage => !!p)
        },
        async store(signed, files) {
            const manifest = verifySignedManifest(signed, dev)
            if (!manifest) throw new Error('package signature does not verify')
            const base = `${WEB_ROOT}${manifest.version}/`
            const entries = await Promise.all(
                manifest.files.map(async (f) => {
                    const bytes = decodeBase64(files[f.path] ?? '')
                    if (!(await fileMatches(f, bytes)))
                        throw new Error(`${f.path} does not match its manifest`)
                    return [f.path, bytes] as const
                }),
            )
            const cache = await caches.open(CACHE)
            for (const [path, bytes] of entries)
                await cache.put(
                    base + path,
                    new Response(bytes as Uint8Array<ArrayBuffer>, {
                        headers: { 'Content-Type': typeOf(path) },
                    }),
                )
            // The signature goes in last: a half-written package never lists.
            await cache.put(
                base + SIGNED,
                new Response(JSON.stringify(signed), {
                    headers: { 'Content-Type': TYPES['.json'] },
                }),
            )
            return { version: manifest.version, hostApi: manifest.hostApi }
        },
        async remove(version) {
            const cache = await caches.open(CACHE)
            const prefix = `${WEB_ROOT}${version}/`
            const keys = (await cache.keys()).filter((r) =>
                new URL(r.url).pathname.startsWith(prefix),
            )
            await Promise.all(keys.map((r) => cache.delete(r)))
        },
        baseUrl: (version) => `${WEB_ROOT}${version}/`,
    }
}

interface IpcBridge {
    invoke(channel: string, ...args: unknown[]): Promise<unknown>
}

function bridge(): IpcBridge {
    const api = (globalThis as { api?: IpcBridge }).api
    if (!api) throw new Error('No desktop bridge')
    return api
}

export function createDesktopPackageStore(): PackageStore {
    return {
        prepare: async () => undefined,
        list: async () =>
            (await bridge().invoke(
                IpcChannels.PACKAGE_LIST,
            )) as StoredPackage[],
        store: async (signed, files) =>
            (await bridge().invoke(IpcChannels.PACKAGE_STORE, {
                signed,
                files,
            })) as StoredPackage,
        remove: async (version) => {
            await bridge().invoke(IpcChannels.PACKAGE_REMOVE, version)
        },
        baseUrl: (version) => `remappr-pkg://builder/${version}/`,
    }
}

export function packageStore(): PackageStore {
    return isElectron() ? createDesktopPackageStore() : createWebPackageStore()
}
