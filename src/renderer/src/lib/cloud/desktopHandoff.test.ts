// pattern-check: skip — unit tests for the desktop sign-in handoff helpers
import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { isHandoffState, newHandoff, stateOf } from './desktopHandoff'

describe('desktop handoff', () => {
    it('derives the state as base64url(sha256(nonce)), like the server', async () => {
        const nonce = 'n'.repeat(43)
        const expected = createHash('sha256').update(nonce).digest('base64url')
        expect(await stateOf(nonce)).toBe(expected)
    })

    it('makes fresh 43-character nonces whose state checks out', async () => {
        const a = await newHandoff()
        const b = await newHandoff()
        expect(a.nonce).not.toBe(b.nonce)
        expect(a.nonce).toMatch(/^[A-Za-z0-9_-]{43}$/)
        expect(isHandoffState(a.state)).toBe(true)
        expect(await stateOf(a.nonce)).toBe(a.state)
        expect(a.state).not.toContain(a.nonce)
    })

    it('accepts only well-formed states', () => {
        expect(isHandoffState('A'.repeat(43))).toBe(true)
        expect(isHandoffState('A'.repeat(42))).toBe(false)
        expect(isHandoffState('A'.repeat(42) + '=')).toBe(false)
        expect(isHandoffState(null)).toBe(false)
    })
})
