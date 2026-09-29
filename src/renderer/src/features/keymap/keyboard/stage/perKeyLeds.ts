// Pattern check: no GoF pattern (-) — rejected — pure key→LED helpers for usePerKeyPaint, one caller, plain functions.
import type { HsvColor } from '@firmware/service'

/** One setPerKeyColors call: LEDs start, start+1, … each take their colour. */
export interface LedRun {
    start: number
    colors: HsvColor[]
}

/** The LEDs under each key when the firmware has no map: one per key, in
 *  layout order. */
export function identityKeyLeds(keyCount: number): number[][] {
    return Array.from({ length: keyCount }, (_, i) => [i])
}

/** Group LED → colour writes into runs of consecutive LEDs, at most `maxRun`
 *  long, so each run is one setPerKeyColors call. */
export function ledRuns(
    colors: ReadonlyMap<number, HsvColor>,
    maxRun: number,
): LedRun[] {
    const runs: LedRun[] = []
    const sorted = [...colors.entries()].sort((a, b) => a[0] - b[0])
    for (const [led, color] of sorted) {
        const last = runs.at(-1)
        const extendsLast =
            last &&
            last.colors.length < maxRun &&
            led === last.start + last.colors.length
        if (extendsLast) last.colors.push(color)
        else runs.push({ start: led, colors: [color] })
    }
    return runs
}

/** How many LEDs to read, from 0, to cover every key's LEDs. */
export function ledSpan(keyLeds: readonly number[][]): number {
    return Math.max(0, ...keyLeds.flat().map((led) => led + 1))
}
