// pattern-check: skip — assertions over the class merger
import { describe, expect, it } from 'vitest'
import { cn } from './cn'

describe('cn', () => {
    it('keeps a design-system size next to a text colour', () => {
        expect(cn('text-control', 'text-foreground')).toBe(
            'text-control text-foreground',
        )
    })

    it('still lets a later size win over an earlier one', () => {
        expect(cn('text-caption', 'text-meta')).toBe('text-meta')
        expect(cn('text-xs', 'text-panel-title')).toBe('text-panel-title')
    })
})
