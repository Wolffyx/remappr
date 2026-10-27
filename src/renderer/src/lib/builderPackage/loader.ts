// pattern-check: skip — a pure manifest check plus the sequenced load; one
// caller (App's lazy builder).
//
// Loads the builder from a delivered package instead of the app bundle: read
// its manifest, refuse it when it was built for another host API or needs a
// module this host does not provide, check every file's sha256, fill the host
// module registry, add its stylesheet, then import it.
import type { ComponentType } from 'react'
import { HOST_API, HOST_MODULES } from './hostModules'

export interface PackageFile {
    path: string
    sha256: string
    bytes: number
}

export interface PackageManifest {
    name: string
    version: string
    /** Semver range of host APIs it runs on, e.g. "^1". */
    hostApi: string
    hostModules: string[]
    files: PackageFile[]
}

export interface BuilderPackage {
    version: string
    BuilderRoot: ComponentType
    licensee: string
}

const REGISTRY = '__REMAPPR_HOST__'
const STYLE_ID = 'remappr-builder-package-css'

/** Why this host cannot run the package, or null when it can. */
export function manifestProblem(
    manifest: PackageManifest,
    hostApi: number = HOST_API,
    provided: Readonly<Record<string, unknown>> = HOST_MODULES,
): string | null {
    const major = /^\^(\d+)$/.exec(manifest.hostApi)?.[1]
    if (!major || Number(major) !== hostApi)
        return `built for host API ${manifest.hostApi}, this app provides ${hostApi}`
    const missing = manifest.hostModules.filter((m) => !(m in provided))
    if (missing.length)
        return `needs modules this app does not provide: ${missing.join(', ')}`
    return null
}

async function sha256Hex(bytes: ArrayBuffer): Promise<string> {
    const d = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))
    return [...d].map((b) => b.toString(16).padStart(2, '0')).join('')
}

async function checkFiles(
    base: URL,
    files: readonly PackageFile[],
): Promise<void> {
    await Promise.all(
        files.map(async (f) => {
            const res = await fetch(new URL(f.path, base))
            if (!res.ok) throw new Error(`${f.path}: HTTP ${res.status}`)
            if ((await sha256Hex(await res.arrayBuffer())) !== f.sha256)
                throw new Error(`${f.path} does not match its manifest`)
        }),
    )
}

/** Load the host modules the package needs into the registry it reads. */
async function installHostModules(specs: readonly string[]): Promise<void> {
    const loaded = await Promise.all(
        specs.map(async (s) => [s, await HOST_MODULES[s]()] as const),
    )
    const g = globalThis as Record<string, unknown>
    const registry =
        (g[REGISTRY] as Map<string, unknown> | undefined) ??
        new Map<string, unknown>()
    for (const [spec, mod] of loaded) registry.set(spec, mod)
    g[REGISTRY] = registry
}

function addStylesheet(href: string): void {
    const existing = document.getElementById(STYLE_ID) as HTMLLinkElement | null
    if (existing?.href === href) return
    existing?.remove()
    const link = document.createElement('link')
    link.id = STYLE_ID
    link.rel = 'stylesheet'
    link.href = href
    document.head.appendChild(link)
}

/** Load the builder package served at `baseUrl` (a folder with manifest.json). */
export async function loadBuilderPackage(
    baseUrl: string,
): Promise<BuilderPackage> {
    const base = new URL(
        baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`,
        window.location.href,
    )
    const res = await fetch(new URL('manifest.json', base))
    if (!res.ok) throw new Error(`builder package manifest: HTTP ${res.status}`)
    const manifest = (await res.json()) as PackageManifest
    const problem = manifestProblem(manifest)
    if (problem)
        throw new Error(
            `Builder ${manifest.version} cannot run here: ${problem}`,
        )
    await checkFiles(base, manifest.files)
    await installHostModules(manifest.hostModules)
    addStylesheet(new URL('style.css', base).href)
    const mod = (await import(
        /* @vite-ignore */ new URL('index.mjs', base).href
    )) as {
        BuilderRoot: ComponentType
        LICENSEE: string
    }
    return {
        version: manifest.version,
        BuilderRoot: mod.BuilderRoot,
        licensee: mod.LICENSEE,
    }
}
