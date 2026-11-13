import { describe, expect, it } from 'vitest'
import { priceLabel } from './billing'

describe('priceLabel', () => {
    it('labels subscriptions per interval and one-time prices once', () => {
        expect(
            priceLabel(
                { amountCents: 499, currency: 'eur', interval: 'month' },
                'en-US',
            ),
        ).toBe('€4.99 / month')
        expect(
            priceLabel(
                { amountCents: 4900, currency: 'usd', interval: null },
                'en-US',
            ),
        ).toBe('$49 once')
    })

    it('has none without a price', () => {
        expect(
            priceLabel({ amountCents: null, currency: 'eur', interval: null }),
        ).toBeNull()
        expect(
            priceLabel({ amountCents: 100, currency: null, interval: null }),
        ).toBeNull()
    })
})
