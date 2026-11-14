// pattern-check: skip — table tests for the device error text, no production logic
import { describe, expect, it } from 'vitest'
import { describeDeviceError } from './deviceErrorText'

describe('describeDeviceError (L4.18)', () => {
    it.each([
        [
            'WRITE_CONFIG_BEGIN failed: ERR_AUTH',
            'did not accept this computer',
            'pair',
        ],
        [
            'COMMIT_CONFIG failed: ERR_VERSION',
            'changed since it was read',
            'Reconnect',
        ],
        [
            'COMMIT_CONFIG failed: ERR_ACTIVATE',
            'could not apply it',
            'previous config',
        ],
        [
            'WRITE_CONFIG_CHUNK failed: ERR_STORAGE',
            'could not write its storage',
            'Save again',
        ],
        ['VALIDATE_CONFIG failed: ERR_INVALID', 'rejected the config', 'Undo'],
        ['WRITE_CONFIG_BEGIN failed: ERR_STATE', 'busy', 'Wait'],
        ['SET_X failed: ERR_ARG', 'did not understand', 'Update the firmware'],
        ['SET_X failed: ERR_CMD', 'does not support', 'Update the firmware'],
    ])('%s → user text with a remediation hint', (raw, message, hint) => {
        const r = describeDeviceError(new Error(raw))
        expect(r.message).toContain(message)
        expect(r.hint).toContain(hint)
        // The raw status stays in the hint for bug reports.
        expect(r.hint).toContain(raw.split(': ')[1])
    })

    it('maps the oversize preflight to a remove-something hint', () => {
        const r = describeDeviceError(
            new Error(
                'The config was not saved: config is 9000 bytes but this device stores at most 8192',
            ),
        )
        expect(r.message).toBe('The config is too large for this device.')
        expect(r.hint).toContain('Remove some')
        expect(r.hint).toContain('9000 bytes')
    })

    it('says nothing was written for a save the client refused', () => {
        const r = describeDeviceError(
            new Error(
                'The config was not saved: binding 3 could not be lowered',
            ),
        )
        expect(r.message).toBe('The config was not saved.')
        expect(r.hint).toContain('binding 3 could not be lowered')
        expect(r.hint).toContain('Nothing was written')
    })

    it('keeps an unknown error as it is', () => {
        expect(describeDeviceError(new Error('NVS full'))).toEqual({
            message: 'NVS full',
        })
        expect(describeDeviceError('boom')).toEqual({ message: 'boom' })
        expect(describeDeviceError(undefined).message).toBe(
            'The device did not answer.',
        )
    })

    it('does not mistake another firmware code for a device status', () => {
        expect(
            describeDeviceError(new Error('SAVE_CHANGES_ERR_NO_SPACE')).hint,
        ).toBeUndefined()
    })
})
