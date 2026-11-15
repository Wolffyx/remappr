// Behavior-family gating: a keyboard built without a family (Capabilities.
// behaviors flag `false`) hides that family's tools; absent flags keep all.
import { describe, expect, it } from 'vitest'

import type { KeyboardService } from '@firmware/service'
import { MockKeyboardService } from '@firmware/clients/mock/service'

import { serviceHasFamily } from './behaviorFamily'
import { FEATURE_PROBES } from './useFeatureAvailable'

const withBehaviors = (
    behaviors: KeyboardService['capabilities']['behaviors'],
): KeyboardService => {
    const s = new MockKeyboardService()
    return Object.assign(Object.create(s) as KeyboardService, {
        capabilities: { ...s.capabilities, behaviors },
    })
}

describe('serviceHasFamily', () => {
    it('is true when the service says nothing (older or other firmware)', () => {
        expect(serviceHasFamily(null, 'combos')).toBe(true)
        expect(serviceHasFamily(withBehaviors(undefined), 'combos')).toBe(true)
        expect(
            serviceHasFamily(withBehaviors({ capsWord: true }), 'macros'),
        ).toBe(true)
    })

    it('is false only for a family flagged false', () => {
        const s = withBehaviors({ combos: false, macros: true })
        expect(serviceHasFamily(s, 'combos')).toBe(false)
        expect(serviceHasFamily(s, 'macros')).toBe(true)
    })
})

describe('family-gated feature probes', () => {
    it('keeps the Unicode and conditional-layers tools on a full keyboard', () => {
        const s = new MockKeyboardService()
        expect(FEATURE_PROBES.conditionalLayers(s)).toBeTruthy()
        expect(FEATURE_PROBES.limits(s)).toBeTruthy()
    })

    it('hides conditional layers on a keyboard built without them', () => {
        expect(
            FEATURE_PROBES.conditionalLayers(
                withBehaviors({ conditionals: false }),
            ),
        ).toBeFalsy()
    })

    it('hides the Unicode input method on a keyboard built without Unicode', () => {
        const s = withBehaviors({ unicode: false })
        Object.assign(s, { unicode: {} })
        expect(FEATURE_PROBES.unicode(s)).toBeFalsy()
        expect(
            FEATURE_PROBES.unicode(
                Object.assign(withBehaviors({}), { unicode: {} }),
            ),
        ).toBeTruthy()
    })
})
