// pattern-check: skip type guard narrowing the optional indicator pair
import type { RgbApi } from '@firmware/service'

/** Indicator control is optional on RgbApi; the indicator panel needs both
 *  halves. */
export type IndicatorRgb = RgbApi &
    Required<Pick<RgbApi, 'getIndicators' | 'setIndicators'>>

export const hasIndicators = (rgb: RgbApi): rgb is IndicatorRgb =>
    !!rgb.getIndicators && !!rgb.setIndicators
