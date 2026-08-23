// pattern-check: skip — unit test: the demo mock satisfies BOTH gates the config-
// blob editors need to appear + render (the `limits` FeatureGate + the editor
// capability guard). The .tsx render itself is node-untestable (no jsdom).
import { describe, expect, it } from 'vitest'

import { MockKeyboardService } from '@firmware/clients/mock/service'
import { supportsConfigEditing } from '@firmware/configEditing'

import { FEATURE_PROBES } from './useFeatureAvailable'

describe('demo mode config-blob editor gates', () => {
    it('the mock opens the `limits` FeatureGate (toolbar buttons show)', () => {
        expect(FEATURE_PROBES.limits(new MockKeyboardService())).toBeTruthy()
    })

    it('the mock passes the editor guard (modals render, not the null branch)', () => {
        expect(supportsConfigEditing(new MockKeyboardService())).toBe(true)
    })
})
