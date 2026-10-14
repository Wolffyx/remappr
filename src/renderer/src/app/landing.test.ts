// pattern-check: skip — unit tests for the landing rule table.
import { describe, expect, it } from 'vitest'
import type { KeyboardService } from '@firmware/service'
import type { LockKind } from '@firmware/types'
import { needsTitleBar, resolveLanding, type LandingState } from './landing'

function service(
    extra: { kind?: KeyboardService['kind']; lock?: LockKind } = {},
): KeyboardService {
    return {
        kind: extra.kind,
        capabilities: { lock: extra.lock ?? 'none' },
    } as unknown as KeyboardService
}

const state = (s: Partial<LandingState>): LandingState => ({
    builderOpen: false,
    service: null,
    lockState: 'unlocked',
    ...s,
})

describe('resolveLanding', () => {
    it('shows the builder over anything else', () => {
        expect(
            resolveLanding(state({ builderOpen: true, service: service() })),
        ).toBe('builder')
    })

    it('shows the start page without a device', () => {
        expect(resolveLanding(state({}))).toBe('start')
    })

    it('asks to unlock an editor-locked device first', () => {
        const s = service({ kind: 'mouse', lock: 'editor' })
        expect(resolveLanding(state({ service: s, lockState: 'locked' }))).toBe(
            'unlock',
        )
        expect(resolveLanding(state({ service: s }))).toBe('mouse')
    })

    it('lands keyless devices on their own pages', () => {
        expect(
            resolveLanding(state({ service: service({ kind: 'dongle' }) })),
        ).toBe('dongle')
        expect(
            resolveLanding(state({ service: service({ kind: 'mouse' }) })),
        ).toBe('mouse')
    })

    it('opens the keymap editor for a keyboard', () => {
        expect(resolveLanding(state({ service: service() }))).toBe('keymap')
        expect(
            resolveLanding(state({ service: service({ kind: 'keyboard' }) })),
        ).toBe('keymap')
    })
})

describe('needsTitleBar', () => {
    it('adds the title bar only where the screen has no header', () => {
        expect(needsTitleBar('unlock')).toBe(true)
        expect(needsTitleBar('dongle')).toBe(true)
        expect(needsTitleBar('keymap')).toBe(false)
        expect(needsTitleBar('start')).toBe(false)
        expect(needsTitleBar('builder')).toBe(false)
    })
})
