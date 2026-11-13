// pattern-check: skip — tests for the pure publish-package checks.
//
// deno test supabase/functions/_shared/publish.test.ts
import { assertEquals } from 'jsr:@std/assert@1'
import { sha256Hex } from './license.ts'
import {
    channelsFor,
    checkPackage,
    compareVersions,
    PUBLISHER,
    publishChannel,
    sameFiles,
} from './publish.ts'

const workflowAt = (ref: string): string =>
    `${PUBLISHER.repository}/${PUBLISHER.workflow}@${ref}`

const claims = (ref: string, over: Record<string, unknown> = {}) => ({
    repository: PUBLISHER.repository,
    repository_id: PUBLISHER.repositoryId,
    ref,
    job_workflow_ref: workflowAt(ref),
    ...over,
})

Deno.test('main publishes stable, dev publishes beta', () => {
    assertEquals(publishChannel(claims('refs/heads/main')), 'stable')
    assertEquals(publishChannel(claims('refs/heads/dev')), 'beta')
})

Deno.test('other branches, tags and pull requests may not publish', () => {
    assertEquals(publishChannel(claims('refs/heads/feature')), null)
    assertEquals(publishChannel(claims('refs/tags/v1.0.0')), null)
    assertEquals(publishChannel(claims('refs/pull/3/merge')), null)
})

Deno.test(
    'another repo, a re-created repo or another workflow may not publish',
    () => {
        const ref = 'refs/heads/main'
        assertEquals(
            publishChannel(claims(ref, { repository: 'x/remapprBuilder' })),
            null,
        )
        assertEquals(publishChannel(claims(ref, { repository_id: '1' })), null)
        assertEquals(
            publishChannel(
                claims(ref, {
                    job_workflow_ref: `${PUBLISHER.repository}/.github/workflows/other.yml@${ref}`,
                }),
            ),
            null,
        )
        // The workflow file from another branch than the one that ran it.
        assertEquals(
            publishChannel(
                claims(ref, { job_workflow_ref: workflowAt('refs/heads/dev') }),
            ),
            null,
        )
    },
)

const enc = new TextEncoder()

async function pkg(over: Record<string, unknown> = {}) {
    const index = enc.encode('export const x = 1')
    const manifest = {
        name: 'remappr-builder',
        version: '1.2.3',
        hostApi: '^1',
        hostModules: ['react'],
        files: [
            {
                path: 'index.mjs',
                sha256: await sha256Hex(index),
                bytes: index.length,
            },
        ],
        ...over,
    }
    return { text: JSON.stringify(manifest), files: { 'index.mjs': index } }
}

Deno.test('a package matching its manifest passes', async () => {
    const { text, files } = await pkg()
    const r = await checkPackage(text, files, sha256Hex)
    assertEquals('manifest' in r && r.manifest.version, '1.2.3')
})

Deno.test('changed, missing or extra files are refused', async () => {
    const { text } = await pkg()
    const changed = await checkPackage(
        text,
        { 'index.mjs': enc.encode('export const x = 2') },
        sha256Hex,
    )
    assertEquals('error' in changed, true)
    assertEquals('error' in (await checkPackage(text, {}, sha256Hex)), true)
    const { files } = await pkg()
    const extra = await checkPackage(
        text,
        { ...files, 'evil.mjs': enc.encode('') },
        sha256Hex,
    )
    assertEquals('error' in extra && extra.error, 'unlisted file evil.mjs')
})

Deno.test('bad manifests are refused', async () => {
    for (const over of [
        { name: 'other' },
        { version: '1.2' },
        { version: '1.2.3-beta.1' },
        { hostApi: '>=1' },
        { files: [{ path: '../x.mjs', sha256: '', bytes: 0 }] },
    ]) {
        const { text, files } = await pkg(over)
        assertEquals(
            'error' in (await checkPackage(text, files, sha256Hex)),
            true,
            JSON.stringify(over),
        )
    }
    assertEquals('error' in (await checkPackage('{', {}, sha256Hex)), true)
})

Deno.test('sameFiles ignores order', () => {
    const a = { path: 'a', sha256: '1', bytes: 1 }
    const b = { path: 'b', sha256: '2', bytes: 2 }
    assertEquals(sameFiles([a, b], [b, a]), true)
    assertEquals(sameFiles([a], [a, b]), false)
    assertEquals(sameFiles([a], [{ ...a, sha256: '9' }]), false)
})

Deno.test('versions compare numerically; beta also takes stable', () => {
    assertEquals(compareVersions('1.10.0', '1.9.9') > 0, true)
    assertEquals(compareVersions('1.0.0', '1.0.0'), 0)
    assertEquals(channelsFor('beta'), ['stable', 'beta'])
    assertEquals(channelsFor('stable'), ['stable'])
    assertEquals(channelsFor(undefined), ['stable'])
})
