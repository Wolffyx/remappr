// pattern-check: skip — unit test for the machine hash
import { describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => ({ ipcMain: { handle: vi.fn() } }))

import { machineHash } from './machine-id'

describe('machineHash', () => {
    it('hashes the linux machine id with the app salt', async () => {
        const hash = await machineHash('linux')
        // CI and dev machines both have /etc/machine-id.
        expect(hash).toMatch(/^[0-9a-f]{64}$/)
        expect(await machineHash('linux')).toBe(hash)
    })

    it('is null on a platform it cannot read', async () => {
        expect(await machineHash('aix')).toBeNull()
    })
})
