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

import {
    getBuilderStage,
    getPlanSnapshot,
    hasBuilderAccess,
    isBuilderFree,
    needsBuilderActivation,
    setBuilderLicenseValid,
    refreshPlan,
    setPlanSnapshot,
} from './index'

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
    beforeEach(() => {
        installLocalStorage()
        cloud.configured = false
        cloud.client = null
    })

    it('with no backend the compiled stage applies', () => {
        setPlanSnapshot({ freeBuilder: false, builder: false })
        expect(getPlanSnapshot()).toBeNull()
        expect(getBuilderStage()).toBe('alpha')
        expect(isBuilderFree()).toBe(true)
        expect(hasBuilderAccess()).toBe(true)
    })

    it('with a backend but nothing cached the compiled stage applies', () => {
        cloud.configured = true
        expect(hasBuilderAccess()).toBe(true)
        expect(getBuilderStage()).toBe('alpha')
    })

    it('a free plan with builder=1 opens it for everyone', async () => {
        cloud.configured = true
        cloud.client = fakeClient(1, 1)
        expect(await refreshPlan()).toBe(true)
        expect(getBuilderStage()).toBe('alpha')
        expect(hasBuilderAccess()).toBe(true)
    })

    it('a free plan with builder=0 locks it', async () => {
        cloud.configured = true
        cloud.client = fakeClient(0, 0)
        await refreshPlan()
        expect(getBuilderStage()).toBe('ga')
        expect(isBuilderFree()).toBe(false)
        expect(hasBuilderAccess()).toBe(false)
    })

    it('once paid, a purchase needs a device license too', async () => {
        cloud.configured = true
        cloud.client = fakeClient(0, 1)
        await refreshPlan()
        expect(getBuilderStage()).toBe('ga')
        expect(hasBuilderAccess()).toBe(false)
        expect(needsBuilderActivation()).toBe(true)
        setBuilderLicenseValid(true)
        expect(hasBuilderAccess()).toBe(true)
        expect(needsBuilderActivation()).toBe(false)
        setBuilderLicenseValid(false)
    })

    it('a failed read keeps the last cached answer', async () => {
        cloud.configured = true
        cloud.client = fakeClient(0, 0)
        await refreshPlan()
        cloud.client = fakeClient(1, 1, true)
        expect(await refreshPlan()).toBe(false)
        expect(hasBuilderAccess()).toBe(false)
    })

    it('ignores a corrupt cache entry', () => {
        cloud.configured = true
        localStorage.setItem('remappr.plan', '{"freeBuilder":"yes"}')
        expect(getPlanSnapshot()).toBeNull()
    })
})
