// pattern-check: skip — secret store tests with stubbed globals, no production logic
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { IpcChannels } from '@shared/ipc-types'
import {
    getSecret,
    GITHUB_TOKEN_KEY,
    SecretStorageUnavailableError,
    setSecret,
} from './secretStore'

// node env has no localStorage and no window.api; both are stubbed per test.
const mem = new Map<string, string>()

beforeEach(() => {
    mem.clear()
    vi.stubGlobal('localStorage', {
        getItem: (k: string) => mem.get(k) ?? null,
        setItem: (k: string, v: string) => void mem.set(k, String(v)),
        removeItem: (k: string) => void mem.delete(k),
        clear: () => mem.clear(),
    })
})
afterEach(() => vi.unstubAllGlobals())

describe('secretStore (web)', () => {
    it('round-trips a secret through localStorage', async () => {
        await setSecret(GITHUB_TOKEN_KEY, 'ghp_abc')
        expect(mem.get('remappr.secret.githubToken')).toBe('ghp_abc')
        expect(await getSecret(GITHUB_TOKEN_KEY)).toBe('ghp_abc')
    })

    it('returns empty string for an unset key', async () => {
        expect(await getSecret('nope')).toBe('')
    })

    it('clears the key when set to empty', async () => {
        await setSecret('k', 'v')
        await setSecret('k', '')
        expect(await getSecret('k')).toBe('')
        expect(mem.get('remappr.secret.k')).toBeUndefined()
    })
})

/** A fake Electron bridge over an in-memory "encrypted" store. */
function stubBridge(encryptionAvailable: boolean): {
    enc: Map<string, string>
    invoke: ReturnType<typeof vi.fn>
} {
    const enc = new Map<string, string>()
    const invoke = vi.fn(async (channel: string, arg: unknown) => {
        const { key, value } = arg as { key: string; value?: string }
        if (channel === IpcChannels.SECRET_GET) {
            return encryptionAvailable ? (enc.get(key) ?? null) : null
        }
        if (channel === IpcChannels.SECRET_SET) {
            if (!encryptionAvailable) return false
            enc.set(key, value!)
            return true
        }
        if (channel === IpcChannels.SECRET_DELETE) {
            enc.delete(key)
            return true
        }
        throw new Error(`unexpected channel ${channel}`)
    })
    vi.stubGlobal('api', { invoke })
    return { enc, invoke }
}

describe('secretStore (Electron, L4.24)', () => {
    it('stores in the encrypted store, never in localStorage', async () => {
        const { enc } = stubBridge(true)
        await setSecret(GITHUB_TOKEN_KEY, 'ghp_abc')
        expect(enc.get(GITHUB_TOKEN_KEY)).toBe('ghp_abc')
        expect(mem.size).toBe(0)
        expect(await getSecret(GITHUB_TOKEN_KEY)).toBe('ghp_abc')
    })

    it('refuses to fall back to plaintext when safeStorage is unavailable', async () => {
        stubBridge(false)
        await expect(
            setSecret(GITHUB_TOKEN_KEY, 'ghp_abc'),
        ).rejects.toBeInstanceOf(SecretStorageUnavailableError)
        expect(mem.size).toBe(0)
        expect(await getSecret(GITHUB_TOKEN_KEY)).toBe('')
    })

    it('refuses plaintext when the bridge itself errors', async () => {
        vi.stubGlobal('api', {
            invoke: vi.fn(async () => {
                throw new Error('ipc down')
            }),
        })
        await expect(setSecret('k', 'v')).rejects.toBeInstanceOf(
            SecretStorageUnavailableError,
        )
        expect(mem.size).toBe(0)
    })

    it('moves a legacy plaintext value into the encrypted store', async () => {
        mem.set('remappr.secret.k', 'old')
        const { enc } = stubBridge(true)
        expect(await getSecret('k')).toBe('old')
        expect(enc.get('k')).toBe('old')
        expect(mem.has('remappr.secret.k')).toBe(false)
    })

    it('keeps reading a legacy value while encryption stays unavailable', async () => {
        mem.set('remappr.secret.k', 'old')
        stubBridge(false)
        expect(await getSecret('k')).toBe('old')
        expect(mem.get('remappr.secret.k')).toBe('old')
    })

    it('delete clears both the encrypted and the legacy copy', async () => {
        mem.set('remappr.secret.k', 'old')
        const { enc } = stubBridge(true)
        enc.set('k', 'new')
        await setSecret('k', '')
        expect(enc.has('k')).toBe(false)
        expect(mem.has('remappr.secret.k')).toBe(false)
    })
})
