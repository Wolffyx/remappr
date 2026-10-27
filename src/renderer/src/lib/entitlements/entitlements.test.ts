// pattern-check: skip — unit test, no production logic
import { describe, it, expect, beforeEach, vi } from 'vitest'

const cloud = vi.hoisted(() => ({
    configured: false,
    client: null as unknown,
}))
vi.mock('@/lib/cloud/env', () => ({
    isCloudConfigured: () => cloud.configured,
}))
vi.mock('@/lib/cloud/client', () => ({
    getCloudClient: async () => cloud.client,
}))

// The module keeps what the server said in this session, so every test gets a
// fresh copy.
let E: typeof import('./index')

// Vitest runs in the `node` environment (no DOM), so provide a minimal in-memory
// localStorage for the cached plan.
function installLocalStorage(): void {
    const store = new Map<string, string>()
    ;(globalThis as { localStorage?: Storage }).localStorage = {
        getItem: (k) => store.get(k) ?? null,
        setItem: (k, v) => void store.set(k, String(v)),
        removeItem: (k) => void store.delete(k),
        clear: () => store.clear(),
        key: (i) => [...store.keys()][i] ?? null,
        get length() {
            return store.size
        },
    } as Storage
}

/** A client whose free plan and my_plan grant `builder` as given. */
function fakeClient(
    freeBuilder: number,
    myBuilder: number,
    fail = false,
): unknown {
    const error = fail ? { message: 'offline' } : null
    return {
        from: () => ({
            select: () => ({
                eq: () => ({
                    maybeSingle: async () => ({
                        data: { limits: { builder: freeBuilder } },
                        error,
                    }),
                }),
            }),
        }),
        rpc: async () => ({
            data: { limits: { builder: myBuilder }, purchases: [] },
            error: null,
        }),
    }
}

describe('entitlements', () => {
    beforeEach(async () => {
        installLocalStorage()
        cloud.configured = false
        cloud.client = null
        vi.resetModules()
        E = await import('./index')
    })

    it('with no backend the compiled stage applies', () => {
        E.setPlanSnapshot({ freeBuilder: false, builder: false })
        expect(E.getPlanSnapshot()).toBeNull()
        expect(E.getBuilderStage()).toBe('alpha')
        expect(E.isBuilderFree()).toBe(true)
        expect(E.hasBuilderAccess()).toBe(true)
    })

    it('with a backend but nothing cached the compiled stage applies', () => {
        cloud.configured = true
        expect(E.hasBuilderAccess()).toBe(true)
        expect(E.getBuilderStage()).toBe('alpha')
    })

    it('a free plan with builder=1 opens it for everyone', async () => {
        cloud.configured = true
        cloud.client = fakeClient(1, 1)
        expect(await E.refreshPlan()).toBe(true)
        expect(E.getBuilderStage()).toBe('alpha')
        expect(E.hasBuilderAccess()).toBe(true)
    })

    it('a free plan with builder=0 locks it', async () => {
        cloud.configured = true
        cloud.client = fakeClient(0, 0)
        await E.refreshPlan()
        expect(E.getBuilderStage()).toBe('ga')
        expect(E.isBuilderFree()).toBe(false)
        expect(E.hasBuilderAccess()).toBe(false)
    })

    it('once paid, the license owner must be the account here', async () => {
        cloud.configured = true
        cloud.client = fakeClient(0, 1)
        await E.refreshPlan()
        expect(E.getBuilderStage()).toBe('ga')
        expect(E.hasBuilderAccess()).toBe(false)
        expect(E.needsBuilderActivation()).toBe(true)
        E.setBuilderLicense('u1')
        expect(E.needsBuilderActivation()).toBe(false)
        // A license, but nobody signed in: sign in, not buy.
        expect(E.hasBuilderAccess()).toBe(false)
        expect(E.needsBuilderSignIn()).toBe(true)
        E.setBuilderAccount('u2')
        expect(E.hasBuilderAccess()).toBe(false)
        E.setBuilderAccount('u1')
        expect(E.hasBuilderAccess()).toBe(true)
        expect(E.needsBuilderSignIn()).toBe(false)
    })

    it('never takes "free" from the cache', async () => {
        cloud.configured = true
        cloud.client = fakeClient(0, 0)
        await E.refreshPlan()
        expect(E.hasBuilderAccess()).toBe(false)
        // Anyone can write the cache; a new session must not believe it.
        localStorage.setItem(
            'remappr.plan',
            JSON.stringify({ freeBuilder: true, builder: true }),
        )
        expect(E.hasBuilderAccess()).toBe(false)
    })

    it('a failed read keeps the last cached answer', async () => {
        cloud.configured = true
        cloud.client = fakeClient(0, 0)
        await E.refreshPlan()
        cloud.client = fakeClient(1, 1, true)
        expect(await E.refreshPlan()).toBe(false)
        expect(E.hasBuilderAccess()).toBe(false)
    })

    it('ignores a corrupt cache entry', () => {
        cloud.configured = true
        localStorage.setItem('remappr.plan', '{"freeBuilder":"yes"}')
        expect(E.getPlanSnapshot()).toBeNull()
    })
})
