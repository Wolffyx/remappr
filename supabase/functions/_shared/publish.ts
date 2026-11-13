// Pattern check: Dispatch Map (Tier 0) — applied — the branch→channel decision
// for a publishing workflow is a lookup table (main→stable, dev→beta).
//
// Pure checks for publish-package: who may publish (the GitHub Actions OIDC
// claims of the builder repo's release workflow) and whether an upload is the
// package its manifest describes. No I/O, so `deno test` covers them.

export type Channel = 'stable' | 'beta'

/** GitHub's OIDC issuer and the audience the release workflow asks for. */
export const GITHUB_ISSUER = 'https://token.actions.githubusercontent.com'
export const PUBLISH_AUDIENCE = 'remappr-publish-package'

/** The one repository (by id, so a renamed or re-created repo of the same name
 *  is not trusted) and workflow file allowed to publish. */
export const PUBLISHER = {
    repository: 'Wolffyx/remapprBuilder',
    repositoryId: '1269909028',
    workflow: '.github/workflows/release.yml',
} as const

/** Which branch publishes to which channel; any other ref may not publish. */
const CHANNEL_BY_REF: Readonly<Record<string, Channel>> = {
    'refs/heads/main': 'stable',
    'refs/heads/dev': 'beta',
}

export interface WorkflowClaims {
    repository?: unknown
    repository_id?: unknown
    ref?: unknown
    job_workflow_ref?: unknown
    [claim: string]: unknown
}

/** The channel this (already signature-, issuer- and audience-checked) token
 *  may publish to, or null when it is not the builder's release workflow. */
export function publishChannel(claims: WorkflowClaims): Channel | null {
    if (claims.repository !== PUBLISHER.repository) return null
    if (String(claims.repository_id) !== PUBLISHER.repositoryId) return null
    if (typeof claims.ref !== 'string') return null
    const channel = CHANNEL_BY_REF[claims.ref]
    if (!channel) return null
    const workflow = `${PUBLISHER.repository}/${PUBLISHER.workflow}@${claims.ref}`
    return claims.job_workflow_ref === workflow ? channel : null
}

export interface ManifestFile {
    path: string
    sha256: string
    bytes: number
}

export interface PackageManifest {
    name: string
    version: string
    hostApi: string
    hostModules: string[]
    files: ManifestFile[]
}

const VERSION = /^[0-9]+\.[0-9]+\.[0-9]+$/
const HOST_API = /^\^[0-9]+$/
const FILE_PATH = /^[a-z0-9][a-z0-9._-]*$/

function manifestError(m: PackageManifest): string | null {
    if (m.name !== 'remappr-builder') return 'not a builder package'
    if (!VERSION.test(m.version)) return 'version is not X.Y.Z'
    if (!HOST_API.test(m.hostApi)) return 'hostApi is not ^N'
    if (!Array.isArray(m.hostModules)) return 'hostModules missing'
    if (!Array.isArray(m.files) || m.files.length === 0) return 'no files'
    const bad = m.files.find((f) => !FILE_PATH.test(f.path))
    return bad ? `bad file path ${bad.path}` : null
}

/** The manifest when it parses and every listed file is uploaded with its
 *  listed size and sha256 (and nothing else is); otherwise the reason. */
export async function checkPackage(
    manifestText: string,
    files: Readonly<Record<string, Uint8Array>>,
    sha256Hex: (bytes: Uint8Array) => Promise<string>,
): Promise<{ manifest: PackageManifest } | { error: string }> {
    let manifest: PackageManifest
    try {
        manifest = JSON.parse(manifestText) as PackageManifest
    } catch {
        return { error: 'manifest is not JSON' }
    }
    const invalid = manifestError(manifest)
    if (invalid) return { error: invalid }
    const listed = new Set(manifest.files.map((f) => f.path))
    const extra = Object.keys(files).find((p) => !listed.has(p))
    if (extra) return { error: `unlisted file ${extra}` }
    for (const f of manifest.files) {
        const bytes = files[f.path]
        if (!bytes) return { error: `missing file ${f.path}` }
        if (bytes.length !== f.bytes)
            return { error: `${f.path}: size differs` }
        if ((await sha256Hex(bytes)) !== f.sha256)
            return { error: `${f.path}: sha256 differs` }
    }
    return { manifest }
}

/** Whether two file lists are the same package (order does not matter). */
export function sameFiles(
    a: readonly ManifestFile[],
    b: readonly ManifestFile[],
): boolean {
    if (a.length !== b.length) return false
    const key = (f: ManifestFile): string => `${f.path}:${f.sha256}:${f.bytes}`
    const seen = new Set(a.map(key))
    return b.every((f) => seen.has(key(f)))
}

/** Compare X.Y.Z versions numerically. */
export function compareVersions(a: string, b: string): number {
    const pa = a.split('.').map(Number)
    const pb = b.split('.').map(Number)
    for (let i = 0; i < 3; i++) {
        const d = (pa[i] ?? 0) - (pb[i] ?? 0)
        if (d !== 0) return d
    }
    return 0
}

/** The channels a client on `channel` takes packages from. */
export function channelsFor(channel: unknown): Channel[] {
    return channel === 'beta' ? ['stable', 'beta'] : ['stable']
}
