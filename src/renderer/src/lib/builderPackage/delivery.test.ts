// pattern-check: skip — unit tests for the delivery flow over a fake store
import { beforeEach, describe, expect, it, vi } from 'vitest'

interface Row {
    version: string
    host_api: string
    changelog: string
    channel: 'stable' | 'beta'
}

const cloud = vi.hoisted(() => ({
    rows: [] as Row[],
    reply: null as unknown,
    replyError: null as unknown,
    invoked: 0,
    bodies: [] as unknown[],
    free: true,
    channel: 'stable' as 'stable' | 'beta',
}))

/** One stable package for host API 1 (or none). */
function publish(version: string | null, changelog = ''): void {
    cloud.rows = version
        ? [{ version, host_api: '^1', changelog, channel: 'stable' }]
        : []
}

vi.mock('@/lib/entitlements/entitlements', () => ({
    isBuilderFree: () => cloud.free,
}))

vi.mock('@/stores/userSettingsStore', () => ({
    default: { getState: () => ({ builderChannel: cloud.channel }) },
}))

vi.mock('@/lib/secretStore', () => ({ getSecret: async () => '' }))
vi.mock('@/lib/cloud/client', () => ({
    getCloudClient: async () => ({
        from: () => ({
            select: () => ({
                in: async (_col: string, channels: string[]) => ({
                    data: cloud.rows.filter((r) =>
                        channels.includes(r.channel),
                    ),
                    error: null,
                }),
            }),
        }),
        functions: {
            invoke: async (_name: string, opts: { body: unknown }) => {
                cloud.invoked++
                cloud.bodies.push(opts.body)
                return {
                    data: cloud.reply,
                    error:
                        typeof cloud.replyError === 'function'
                            ? cloud.replyError()
                            : cloud.replyError,
                }
            },
        },
    }),
}))

import { ensureBuilderPackage } from './delivery'
import { onBuilderUpdate, type BuilderUpdate } from './updates'
import type { PackageStore, StoredPackage } from './stores'

function fakeStore(
    initial: StoredPackage[] = [],
): PackageStore & { stored: StoredPackage[] } {
    const stored = [...initial]
    return {
        stored,
        prepare: async () => undefined,
        list: async () => [...stored],
        store: async (signed) => {
            const m = JSON.parse(signed.manifest) as {
                version: string
                hostApi: string
                licensee?: string
            }
            const p = {
                version: m.version,
                hostApi: m.hostApi,
                licensee: m.licensee ?? 'u1',
            }
            stored.push(p)
            return p
        },
        remove: async () => undefined,
        baseUrl: (v) => `/_pkg/builder/${v}/`,
    }
}

const reply = (version: string, licensee = 'u1'): unknown => ({
    manifest: JSON.stringify({ version, hostApi: '^1', licensee }),
    signature: 'sig',
    kid: 'k',
    files: {},
})

function setOnline(online: boolean): void {
    vi.stubGlobal('navigator', { onLine: online })
}

describe('ensureBuilderPackage', () => {
    beforeEach(() => {
        publish('1.0.0')
        cloud.reply = null
        cloud.replyError = null
        cloud.invoked = 0
        cloud.bodies = []
        cloud.free = true
        cloud.channel = 'stable'
        setOnline(true)
    })

    it('offline: uses the cached package, or explains there is none', async () => {
        setOnline(false)
        expect(
            await ensureBuilderPackage(
                fakeStore([
                    { version: '1.0.0', hostApi: '^1', licensee: 'u1' },
                ]),
            ),
        ).toBe('1.0.0')
        await expect(ensureBuilderPackage(fakeStore())).rejects.toThrow(
            /connect once/,
        )
    })

    it('online: downloads only when a newer one is published', async () => {
        cloud.reply = reply('1.0.0')
        const empty = fakeStore()
        expect(await ensureBuilderPackage(empty)).toBe('1.0.0')
        expect(cloud.invoked).toBe(1)
        expect(await ensureBuilderPackage(empty)).toBe('1.0.0')
        expect(cloud.invoked).toBe(1)
        publish('1.1.0')
        cloud.reply = reply('1.1.0')
        expect(await ensureBuilderPackage(empty)).toBe('1.1.0')
    })

    it('ignores packages for another host API', async () => {
        setOnline(false)
        await expect(
            ensureBuilderPackage(
                fakeStore([
                    { version: '9.0.0', hostApi: '^2', licensee: 'u1' },
                ]),
            ),
        ).rejects.toThrow()
    })

    it('a failed download falls back to the cached package', async () => {
        publish('2.0.0')
        cloud.replyError = () => ({
            context: new Response(JSON.stringify({ error: 'rate_limited' })),
        })
        expect(
            await ensureBuilderPackage(
                fakeStore([
                    { version: '1.0.0', hostApi: '^1', licensee: 'u1' },
                ]),
            ),
        ).toBe('1.0.0')
        await expect(ensureBuilderPackage(fakeStore())).rejects.toThrow(
            'rate_limited',
        )
    })

    it('once paid, a free-stage copy no longer counts', async () => {
        cloud.free = false
        const freeCopy = { version: '1.0.0', hostApi: '^1', licensee: 'free' }
        setOnline(false)
        await expect(
            ensureBuilderPackage(fakeStore([freeCopy])),
        ).rejects.toThrow(/connect once/)
        // Online, the licensed copy of the same version is fetched.
        setOnline(true)
        cloud.reply = reply('1.0.0')
        const store = fakeStore([freeCopy])
        expect(await ensureBuilderPackage(store)).toBe('1.0.0')
        expect(cloud.invoked).toBe(1)
        expect(store.stored.at(-1)?.licensee).toBe('u1')
    })

    it('announces a download that replaces a cached builder, with its notes', async () => {
        const seen: BuilderUpdate[] = []
        const off = onBuilderUpdate((u) => seen.push(u))
        // A first download is not an update.
        cloud.reply = reply('1.0.0')
        const store = fakeStore()
        await ensureBuilderPackage(store)
        expect(seen).toEqual([])
        publish('1.1.0', '### Features\n\n* knobs')
        cloud.reply = reply('1.1.0')
        expect(await ensureBuilderPackage(store)).toBe('1.1.0')
        expect(seen).toEqual([
            {
                kind: 'ready',
                version: '1.1.0',
                changelog: '### Features\n\n* knobs',
            },
        ])
        off()
    })

    it('asks get-package for the exact newest version on the channel', async () => {
        cloud.rows = [
            {
                version: '1.2.0',
                host_api: '^1',
                changelog: '',
                channel: 'stable',
            },
            {
                version: '1.3.0',
                host_api: '^1',
                changelog: '',
                channel: 'beta',
            },
        ]
        cloud.reply = reply('1.2.0')
        await ensureBuilderPackage(fakeStore())
        expect(cloud.bodies.at(-1)).toMatchObject({
            version: '1.2.0',
            channel: 'stable',
        })
        cloud.channel = 'beta'
        cloud.reply = reply('1.3.0')
        expect(await ensureBuilderPackage(fakeStore())).toBe('1.3.0')
        expect(cloud.bodies.at(-1)).toMatchObject({
            version: '1.3.0',
            channel: 'beta',
        })
    })

    it('a newer builder for a newer host is announced, not downloaded', async () => {
        const seen: BuilderUpdate[] = []
        const off = onBuilderUpdate((u) => seen.push(u))
        cloud.rows = [
            {
                version: '1.0.0',
                host_api: '^1',
                changelog: '',
                channel: 'stable',
            },
            {
                version: '2.0.0',
                host_api: '^2',
                changelog: '',
                channel: 'stable',
            },
        ]
        const store = fakeStore([
            { version: '1.0.0', hostApi: '^1', licensee: 'u1' },
        ])
        expect(await ensureBuilderPackage(store)).toBe('1.0.0')
        expect(cloud.invoked).toBe(0)
        expect(seen).toEqual([{ kind: 'needs-host', version: '2.0.0' }])
        off()
    })
})
