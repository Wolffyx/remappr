import { describe, expect, it, vi } from 'vitest'
import { createAuthStorage, type SecretBackend } from './authStorage'
import { cloudConfig } from './env'

describe('cloudConfig', () => {
    it('is null unless both vars are set', () => {
        expect(cloudConfig({})).toBeNull()
        expect(
            cloudConfig({ VITE_SUPABASE_URL: 'https://x.supabase.co' }),
        ).toBeNull()
        expect(
            cloudConfig({
                VITE_SUPABASE_URL: ' ',
                VITE_SUPABASE_PUBLISHABLE_KEY: 'k',
            }),
        ).toBeNull()
    })

    it('trims both values', () => {
        expect(
            cloudConfig({
                VITE_SUPABASE_URL: ' https://x.supabase.co ',
                VITE_SUPABASE_PUBLISHABLE_KEY: ' sb_publishable_1 ',
            }),
        ).toEqual({
            url: 'https://x.supabase.co',
            publishableKey: 'sb_publishable_1',
        })
    })
})

function memoryBackend(): SecretBackend & { store: Map<string, string> } {
    const store = new Map<string, string>()
    return {
        store,
        get: vi.fn(async (k: string) => store.get(k) ?? ''),
        set: vi.fn(async (k: string, v: string) => {
            store.set(k, v)
        }),
    }
}

describe('createAuthStorage', () => {
    it("maps '' to null and remove to ''", async () => {
        const backend = memoryBackend()
        const storage = createAuthStorage(backend)
        expect(await storage.getItem('s')).toBeNull()
        await storage.setItem('s', 'session')
        expect(await storage.getItem('s')).toBe('session')
        await storage.removeItem('s')
        expect(await storage.getItem('s')).toBeNull()
        expect(backend.store.get('s')).toBe('')
    })

    it('reads the backend once per key', async () => {
        const backend = memoryBackend()
        backend.store.set('s', 'stored')
        const storage = createAuthStorage(backend)
        await storage.getItem('s')
        await storage.getItem('s')
        expect(backend.get).toHaveBeenCalledTimes(1)
    })
})
