// pattern-check: skip — unit tests for the delivery flow over a fake store
import { beforeEach, describe, expect, it, vi } from 'vitest'

const cloud = vi.hoisted(() => ({
    published: '1.0.0' as string | null,
    reply: null as unknown,
    replyError: null as unknown,
    invoked: 0,
    free: true,
}))

vi.mock('@/lib/entitlements/entitlements', () => ({
    isBuilderFree: () => cloud.free,
}))

vi.mock('@/lib/secretStore', () => ({ getSecret: async () => '' }))
vi.mock('@/lib/cloud/client', () => ({
    getCloudClient: async () => ({
        from: () => ({
            select: () => ({
                eq: () => ({
                    eq: () => ({
                        order: () => ({
                            limit: async () => ({
                                data: cloud.published
                                    ? [{ version: cloud.published }]
                                    : [],
                                error: null,
                            }),
                        }),
                    }),
                }),
            }),
        }),
        functions: {
            invoke: async () => {
                cloud.invoked++
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
        cloud.published = '1.0.0'
        cloud.reply = null
        cloud.replyError = null
        cloud.invoked = 0
        cloud.free = true
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
        cloud.published = '1.1.0'
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
        cloud.published = '2.0.0'
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
})
