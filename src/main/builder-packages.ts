// Pattern check: no GoF pattern (-) — rejected — the desktop cache and server
// for delivered builder packages: a pure URL parser, a store/list/remove over
// one folder, and a privileged protocol handler; split only for testing.
//
// Desktop keeps delivered builder packages in userData/packages/builder/<ver>/
// (the files plus signed.json: the exact signed manifest text and its
// signature). remappr-pkg://builder/<ver>/<file> serves them, and only after
// the manifest signature holds under a pinned key and the file's sha256
// matches — checked on every request, so a file changed on disk is refused.
import { app, ipcMain, protocol } from 'electron'
import {
    mkdir,
    readFile,
    readdir,
    rename,
    rm,
    writeFile,
} from 'node:fs/promises'
import { join } from 'node:path'
import { IpcChannels } from '../shared/ipc-types'
import {
    decodeBase64,
    fileMatches,
    verifySignedManifest,
    type PackageSignature,
    type SignedManifest,
} from '../shared/builderPackage'

export const PACKAGE_SCHEME = 'remappr-pkg'
const SIGNED = 'signed.json'
const VERSION_RE = /^\d+\.\d+\.\d+$/
const FILE_RE = /^[A-Za-z0-9._-]+$/
const TYPES: Record<string, string> = {
    '.mjs': 'text/javascript',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
}

/** { version, file } of a remappr-pkg URL, or null when it is not one we serve
 *  (any other host, a bad version, a file name with a path in it). */
export function parsePackageUrl(
    url: string,
): { version: string; file: string } | null {
    let u: URL
    try {
        u = new URL(url)
    } catch {
        return null
    }
    if (u.protocol !== `${PACKAGE_SCHEME}:` || u.hostname !== 'builder')
        return null
    const parts = decodeURIComponent(u.pathname).split('/').filter(Boolean)
    if (parts.length !== 2) return null
    const [version, file] = parts
    if (!VERSION_RE.test(version) || !FILE_RE.test(file)) return null
    return { version, file }
}

export interface StoredPackage {
    version: string
    hostApi: string
}

export interface PackageCache {
    store(
        signed: PackageSignature,
        files: Record<string, string>,
    ): Promise<StoredPackage>
    list(): Promise<StoredPackage[]>
    remove(version: string): Promise<void>
    serve(url: string): Promise<Response>
}

/** The package cache in one folder (userData in the app; a temp dir in tests). */
export function createPackageCache(root: string, dev: boolean): PackageCache {
    const dir = (version: string): string => join(root, version)

    const signedOf = async (
        version: string,
    ): Promise<{
        signed: PackageSignature
        manifest: SignedManifest
    } | null> => {
        const raw = await readFile(join(dir(version), SIGNED), 'utf8').catch(
            () => null,
        )
        if (!raw) return null
        const signed = JSON.parse(raw) as PackageSignature
        const manifest = verifySignedManifest(signed, dev)
        return manifest && manifest.version === version
            ? { signed, manifest }
            : null
    }

    return {
        /** Verify and keep a package. Throws when anything does not check out. */
        async store(
            signed: PackageSignature,
            files: Record<string, string>,
        ): Promise<StoredPackage> {
            const manifest = verifySignedManifest(signed, dev)
            if (!manifest) throw new Error('package signature does not verify')
            const tmp = join(root, `.${manifest.version}.${process.pid}.tmp`)
            await rm(tmp, { recursive: true, force: true })
            await mkdir(tmp, { recursive: true })
            for (const entry of manifest.files) {
                const bytes = decodeBase64(files[entry.path] ?? '')
                if (!(await fileMatches(entry, bytes)))
                    throw new Error(`${entry.path} does not match its manifest`)
                await writeFile(join(tmp, entry.path), bytes)
            }
            await writeFile(join(tmp, SIGNED), JSON.stringify(signed))
            await rm(dir(manifest.version), { recursive: true, force: true })
            await rename(tmp, dir(manifest.version))
            return { version: manifest.version, hostApi: manifest.hostApi }
        },

        /** Every cached package whose signature still verifies. */
        async list(): Promise<StoredPackage[]> {
            const names = await readdir(root).catch(() => [] as string[])
            const found = await Promise.all(
                names
                    .filter((n) => VERSION_RE.test(n))
                    .map(async (v) => (await signedOf(v))?.manifest ?? null),
            )
            return found
                .filter((m): m is SignedManifest => !!m)
                .map((m) => ({ version: m.version, hostApi: m.hostApi }))
        },

        async remove(version: string): Promise<void> {
            if (VERSION_RE.test(version))
                await rm(dir(version), { recursive: true, force: true })
        },

        /** The response for a remappr-pkg URL: the file, or 404 / 403. */
        async serve(url: string): Promise<Response> {
            const target = parsePackageUrl(url)
            if (!target) return new Response(null, { status: 404 })
            const stored = await signedOf(target.version)
            if (!stored) return new Response(null, { status: 403 })
            if (target.file === SIGNED)
                return new Response(JSON.stringify(stored.signed), {
                    headers: { 'Content-Type': TYPES['.json'] },
                })
            const entry = stored.manifest.files.find(
                (f) => f.path === target.file,
            )
            if (!entry) return new Response(null, { status: 404 })
            const bytes = await readFile(join(dir(target.version), entry.path))
            if (!(await fileMatches(entry, bytes)))
                return new Response(null, { status: 403 })
            const ext = entry.path.slice(entry.path.lastIndexOf('.'))
            return new Response(bytes, {
                headers: {
                    'Content-Type': TYPES[ext] ?? 'application/octet-stream',
                },
            })
        },
    }
}

/** The privileges remappr-pkg needs (registered with the other schemes before
 *  ready, since Electron takes one registration call). */
export const PACKAGE_SCHEME_PRIVILEGES = {
    scheme: PACKAGE_SCHEME,
    privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        corsEnabled: true,
    },
}

interface StoreArg {
    signed?: PackageSignature
    files?: Record<string, string>
}

interface SeedReply {
    manifest?: string
    signature?: string
    kid?: string
    files?: Record<string, string>
}

/** Free-stage builds ship a seed package (renderer/_seed/builder.json, see
 *  scripts/fetch-builder-seed.cjs); keep it when the cache is empty, so the
 *  builder opens on the first run without a network. */
export async function installSeed(
    cache: PackageCache,
    seedFile: string,
): Promise<boolean> {
    if ((await cache.list()).length > 0) return false
    const raw = await readFile(seedFile, 'utf8').catch(() => null)
    if (!raw) return false
    const seed = JSON.parse(raw) as SeedReply
    if (!seed.manifest || !seed.signature || !seed.kid || !seed.files)
        return false
    await cache.store(
        { manifest: seed.manifest, signature: seed.signature, kid: seed.kid },
        seed.files,
    )
    return true
}

/** After app ready: serve the scheme and handle store / list / remove. */
export function registerPackageHandlers(): void {
    const cache = createPackageCache(
        join(app.getPath('userData'), 'packages', 'builder'),
        !app.isPackaged,
    )
    // The renderer is served from out/renderer in packaged builds.
    installSeed(cache, join(__dirname, '../renderer/_seed/builder.json')).catch(
        (e: unknown) =>
            console.warn('[builder-packages] seed not installed', e),
    )
    protocol.handle(PACKAGE_SCHEME, (req) => cache.serve(req.url))
    ipcMain.handle(IpcChannels.PACKAGE_STORE, (_e, arg: StoreArg) => {
        if (!arg?.signed || !arg.files) throw new Error('bad package')
        return cache.store(arg.signed, arg.files)
    })
    ipcMain.handle(IpcChannels.PACKAGE_LIST, () => cache.list())
    ipcMain.handle(IpcChannels.PACKAGE_REMOVE, (_e, version: unknown) =>
        typeof version === 'string' ? cache.remove(version) : undefined,
    )
}
