// pattern-check: skip — table tests for the update mode decision.
import { describe, expect, it } from 'vitest'
import { updateMode, type InstallFacts } from './update-mode'

const facts = (over: Partial<InstallFacts>): InstallFacts => ({
    platform: 'linux',
    isPackaged: true,
    macSigned: false,
    ...over,
})

describe('updateMode', () => {
    it('AppImage updates itself; deb/rpm/pacman/tar.gz only notify', () => {
        expect(updateMode(facts({ appImage: '/x/Remappr.AppImage' }))).toBe(
            'auto',
        )
        expect(updateMode(facts({}))).toBe('notify')
    })

    it('the NSIS install updates itself; the portable exe only notifies', () => {
        expect(updateMode(facts({ platform: 'win32' }))).toBe('auto')
        expect(
            updateMode(facts({ platform: 'win32', portableDir: 'C:\\x' })),
        ).toBe('notify')
    })

    it('macOS updates itself only when Developer ID signed', () => {
        expect(updateMode(facts({ platform: 'darwin', macSigned: true }))).toBe(
            'auto',
        )
        expect(updateMode(facts({ platform: 'darwin' }))).toBe('notify')
    })

    it('dev runs and unknown platforms only notify', () => {
        expect(updateMode(facts({ isPackaged: false, appImage: '/x' }))).toBe(
            'notify',
        )
        expect(updateMode(facts({ platform: 'freebsd' }))).toBe('notify')
    })
})
