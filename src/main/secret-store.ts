// pattern-check: skip — Electron IPC handlers wrapping safeStorage + a JSON
// file; procedural OS-keychain persistence, no abstraction.
//
// OS-encrypted secret storage for the main process. The renderer keeps secrets
// (currently just the GitHub build token) out of plain localStorage by routing
// through here: values are encrypted with Electron's safeStorage (DPAPI on
// Windows, Keychain on macOS, libsecret/kwallet on Linux) and persisted as
// base64 in userData/secrets.json. If OS encryption is unavailable the handlers
// fail closed (return null/false); the renderer then refuses to persist the
// secret rather than writing it in plaintext (see renderer lib/secretStore).
import { app, ipcMain, safeStorage } from 'electron'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { IpcChannels } from '../shared/ipc-types'
import { createLogger } from '../shared/logger'

const log = createLogger('secret-store')

function storeFile(): string {
    return join(app.getPath('userData'), 'secrets.json')
}

function readAll(): Record<string, string> {
    try {
        const f = storeFile()
        return existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : {}
    } catch (e) {
        log.error('failed to read secret store', e)
        return {}
    }
}

function writeAll(map: Record<string, string>): void {
    try {
        const f = storeFile()
        mkdirSync(dirname(f), { recursive: true })
        writeFileSync(f, JSON.stringify(map), { mode: 0o600 })
    } catch (e) {
        log.error('failed to write secret store', e)
    }
}

function keyOf(arg: unknown): string | null {
    const k = (arg as { key?: unknown })?.key
    return typeof k === 'string' && k ? k : null
}

/** Decrypt a stored secret for main-process use (e.g. attaching the GitHub
 *  token to an artifact download). Returns null when absent or encryption is
 *  unavailable. */
export function getStoredSecret(key: string): string | null {
    if (!key || !safeStorage.isEncryptionAvailable()) return null
    const enc = readAll()[key]
    if (!enc) return null
    try {
        return safeStorage.decryptString(Buffer.from(enc, 'base64'))
    } catch (e) {
        log.error('decrypt failed', e)
        return null
    }
}

/** Register secret:get/set/delete IPC handlers. Call once at startup. */
export function registerSecretHandlers(): void {
    ipcMain.handle(IpcChannels.SECRET_GET, (_e, arg: unknown) => {
        const key = keyOf(arg)
        return key ? getStoredSecret(key) : null
    })

    ipcMain.handle(IpcChannels.SECRET_SET, (_e, arg: unknown) => {
        const key = keyOf(arg)
        const value = (arg as { value?: unknown })?.value
        if (!key || typeof value !== 'string') return false
        if (!safeStorage.isEncryptionAvailable()) return false
        try {
            const enc = safeStorage.encryptString(value).toString('base64')
            const all = readAll()
            all[key] = enc
            writeAll(all)
            return true
        } catch (e) {
            log.error('encrypt failed', e)
            return false
        }
    })

    ipcMain.handle(IpcChannels.SECRET_DELETE, (_e, arg: unknown) => {
        const key = keyOf(arg)
        if (!key) return false
        const all = readAll()
        if (key in all) {
            delete all[key]
            writeAll(all)
        }
        return true
    })
}
