// pattern-check: skip — unit tests for the backup document mapping
import { describe, expect, it } from 'vitest'
import type { ProfileBackup } from '@/stores/profileBackupStore'
import { backupDocument, cloudDeviceKey } from './deviceBackups'

const backup: ProfileBackup = {
    deviceName: 'Corne',
    firmware: 'zmk',
    serialNumber: 'SERIAL-1',
    keymap: {
        layers: [],
        activeLayoutId: 0,
    } as unknown as ProfileBackup['keymap'],
    hash: 'abc',
    dismissedHash: 'xyz',
    savedAt: 1,
    cloud: true,
}

describe('deviceBackups', () => {
    it('strips the serial and local markers from the uploaded document', () => {
        const doc = backupDocument(backup)
        expect(doc).toMatchObject({
            kind: 'remappr.backup',
            deviceName: 'Corne',
            hash: 'abc',
        })
        expect(doc).not.toHaveProperty('serialNumber')
        expect(doc).not.toHaveProperty('dismissedHash')
        expect(doc).not.toHaveProperty('cloud')
    })

    it('derives a per-account sha-256 device key', async () => {
        const a = await cloudDeviceKey('acct-a', 'SERIAL-1')
        expect(a).toMatch(/^[0-9a-f]{64}$/)
        expect(await cloudDeviceKey('acct-a', 'SERIAL-1')).toBe(a)
        expect(await cloudDeviceKey('acct-b', 'SERIAL-1')).not.toBe(a)
    })
})
