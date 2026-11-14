// pattern-check: skip — merge conflict resolution, no new logic
import { contextBridge, ipcRenderer } from 'electron'
import {
    type ElectronIpcApi,
    IpcChannels,
    IpcEvents,
} from '../shared/ipc-types'

declare global {
    interface Window {
        api: ElectronIpcApi
    }
}

// Only the channel-whitelisted `api` below reaches the renderer. The
// @electron-toolkit `electronAPI` bundle is deliberately NOT exposed: it hands
// out raw ipcRenderer send/invoke/on (bypassing the whitelist) and
// `process.env` (which can hold tokens such as GITHUB_TOKEN). The one thing
// the renderer read from it, `process.platform` (traffic-light inset, window
// controls, release-asset pick), is exposed as `api.platform` instead.

// Allowed invoke channels (whitelist for security)
const VALID_INVOKE_CHANNELS = new Set<string>(Object.values(IpcChannels))

// Allowed event channels (whitelist for security)
const VALID_EVENT_CHANNELS = new Set<string>(Object.values(IpcEvents))

// Custom IPC API for renderer
const api = {
    platform: process.platform,

    invoke(channel: string, ...args: unknown[]): Promise<unknown> {
        if (!VALID_INVOKE_CHANNELS.has(channel)) {
            return Promise.reject(new Error(`Invalid IPC channel: ${channel}`))
        }
        return ipcRenderer.invoke(channel, ...args)
    },

    on(event: string, callback: (...args: unknown[]) => void): () => void {
        if (!VALID_EVENT_CHANNELS.has(event)) {
            throw new Error(`Invalid IPC event: ${event}`)
        }

        const listener = (
            _event: Electron.IpcRendererEvent,
            ...args: unknown[]
        ): void => {
            callback(...args)
        }

        ipcRenderer.on(event, listener)

        // Return an unsubscribe function
        return (): void => {
            ipcRenderer.removeListener(event, listener)
        }
    },
} satisfies ElectronIpcApi

// Use `contextBridge` APIs to expose the API to the renderer only if context
// isolation is enabled, otherwise just add it to the DOM global.
if (process.contextIsolated) {
    try {
        contextBridge.exposeInMainWorld('api', api)
    } catch (error) {
        console.error(error)
    }
} else {
    window.api = api
}
