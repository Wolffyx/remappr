// Pattern check: no GoF pattern (-) — rejected — a one-time migration: dump the
// old file:// storage through a hidden window, hand it to the renderer once.
//
// Moving the packaged renderer from file:// to app://remappr changes its
// storage origin, so settings (localStorage) and the local library (IndexedDB
// remappr-library) would seem to vanish. On the first app:// start, a hidden
// window on a blank file:// page reads the old storage and the renderer
// writes it into the new origin before anything else reads storage. The
// builder license's device key cannot be copied (it is non-extractable); the
// app activates the device again on its own.
import { app, BrowserWindow, ipcMain } from 'electron'
import { existsSync } from 'node:fs'
import { readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { IpcChannels } from '../shared/ipc-types'

export interface StorageDump {
    localStorage: Record<string, string>
    library: unknown[]
}

const MARKER = 'app-origin-migrated'
const PENDING = 'app-origin-migration.json'

// Runs inside the hidden file:// page.
const DUMP_SCRIPT = `(async () => {
    const localStorageDump = {}
    for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i)
        localStorageDump[k] = localStorage.getItem(k)
    }
    const library = await new Promise((resolve) => {
        const req = indexedDB.open('remappr-library')
        req.onupgradeneeded = () => req.transaction.abort()
        req.onerror = () => resolve([])
        req.onsuccess = () => {
            const db = req.result
            if (!db.objectStoreNames.contains('entries')) return resolve([])
            const all = db.transaction('entries').objectStore('entries').getAll()
            all.onsuccess = () => resolve(all.result)
            all.onerror = () => resolve([])
        }
    })
    return { localStorage: localStorageDump, library }
})()`

/** Whether a dump has anything worth handing over. */
export function hasContent(dump: StorageDump): boolean {
    return Object.keys(dump.localStorage).length > 0 || dump.library.length > 0
}

async function dumpFileOrigin(userData: string): Promise<StorageDump> {
    const page = join(userData, 'migrate-blank.html')
    await writeFile(page, '<!doctype html><title>migrate</title>')
    const win = new BrowserWindow({
        show: false,
        webPreferences: {
            sandbox: true,
            contextIsolation: true,
            nodeIntegration: false,
        },
    })
    try {
        await win.loadFile(page)
        return (await win.webContents.executeJavaScript(
            DUMP_SCRIPT,
        )) as StorageDump
    } finally {
        win.destroy()
        await rm(page, { force: true })
    }
}

/** Before the main window loads app://: dump the old file:// storage once. */
export async function prepareStorageMigration(): Promise<void> {
    const userData = app.getPath('userData')
    if (existsSync(join(userData, MARKER))) return
    try {
        const dump = await dumpFileOrigin(userData)
        if (hasContent(dump))
            await writeFile(join(userData, PENDING), JSON.stringify(dump))
    } catch (e) {
        console.warn('[storage-migration] could not read the old storage', e)
    }
    await writeFile(join(userData, MARKER), new Date().toISOString())
}

/** The renderer takes the dump once (then it is deleted). */
export function registerStorageMigrationHandler(): void {
    ipcMain.handle(IpcChannels.STORAGE_MIGRATION_TAKE, async () => {
        const file = join(app.getPath('userData'), PENDING)
        const raw = await readFile(file, 'utf8').catch(() => null)
        if (!raw) return null
        await rm(file, { force: true })
        return JSON.parse(raw) as StorageDump
    })
}
