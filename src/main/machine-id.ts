// Pattern check: Dispatch Map (Tier 0) — applied — platform → how to read the
// OS machine id; the hash and the IPC handler are one shared path.
//
// Desktop builder licenses also name the machine: sha256(app salt ‖ OS machine
// id), so a license copied with the browser profile to another computer fails.
// The raw id never leaves main; the renderer gets only the salted hash.
import { createHash } from 'node:crypto'
import { execFile } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { promisify } from 'node:util'
import { ipcMain } from 'electron'
import { IpcChannels } from '../shared/ipc-types'

const run = promisify(execFile)
const APP_SALT = 'remappr.license.machine.v1'

const READERS: Partial<Record<NodeJS.Platform, () => Promise<string>>> = {
    linux: async () =>
        readFile('/etc/machine-id', 'utf8').catch(() =>
            readFile('/var/lib/dbus/machine-id', 'utf8'),
        ),
    win32: async () => {
        const { stdout } = await run('reg', [
            'query',
            'HKLM\\SOFTWARE\\Microsoft\\Cryptography',
            '/v',
            'MachineGuid',
        ])
        return /MachineGuid\s+REG_SZ\s+(\S+)/.exec(stdout)?.[1] ?? ''
    },
    darwin: async () => {
        const { stdout } = await run('ioreg', [
            '-rd1',
            '-c',
            'IOPlatformExpertDevice',
        ])
        return /"IOPlatformUUID" = "([^"]+)"/.exec(stdout)?.[1] ?? ''
    },
}

/** The salted machine hash (hex), or null when the OS id is unreadable. */
export async function machineHash(
    platform: NodeJS.Platform = process.platform,
): Promise<string | null> {
    const read = READERS[platform]
    if (!read) return null
    const id = (await read().catch(() => '')).trim()
    if (!id) return null
    return createHash('sha256').update(`${APP_SALT}:${id}`).digest('hex')
}

let cached: Promise<string | null> | null = null

export function registerMachineIdHandler(): void {
    ipcMain.handle(IpcChannels.LICENSE_MACHINE_HASH, () => {
        cached ??= machineHash()
        return cached
    })
}
