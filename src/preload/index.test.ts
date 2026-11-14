// pattern-check: skip — unit test with electron mocked, no production logic
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { IpcChannels } from '../shared/ipc-types'

const electron = vi.hoisted(() => ({
    exposed: new Map<string, unknown>(),
    invoke: vi.fn(async () => 'ok'),
}))

vi.mock('electron', () => ({
    contextBridge: {
        exposeInMainWorld: (name: string, value: unknown) =>
            electron.exposed.set(name, value),
    },
    ipcRenderer: {
        invoke: electron.invoke,
        on: vi.fn(),
        removeListener: vi.fn(),
    },
}))

interface ExposedApi {
    invoke(channel: string, ...args: unknown[]): Promise<unknown>
}

describe('preload bridge (L4.22)', () => {
    beforeEach(async () => {
        electron.exposed.clear()
        electron.invoke.mockClear()
        vi.resetModules()
        vi.stubGlobal('process', { ...process, contextIsolated: true })
        await import('./index')
        vi.unstubAllGlobals()
    })

    it('exposes only the whitelisted api, never window.electron', () => {
        expect([...electron.exposed.keys()]).toEqual(['api'])
    })

    it('exposes the host platform on api (no window.electron needed)', () => {
        const api = electron.exposed.get('api') as { platform: string }
        expect(api.platform).toBe(process.platform)
    })

    it('rejects a channel outside the whitelist', async () => {
        const api = electron.exposed.get('api') as ExposedApi
        await expect(api.invoke('evil:channel')).rejects.toThrow(
            'Invalid IPC channel',
        )
        expect(electron.invoke).not.toHaveBeenCalled()
    })

    it('forwards a whitelisted channel', async () => {
        const api = electron.exposed.get('api') as ExposedApi
        await expect(
            api.invoke(IpcChannels.SECRET_GET, { key: 'k' }),
        ).resolves.toBe('ok')
        expect(electron.invoke).toHaveBeenCalledWith(IpcChannels.SECRET_GET, {
            key: 'k',
        })
    })
})
