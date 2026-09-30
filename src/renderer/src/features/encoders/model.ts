// Pattern check: no GoF pattern (-) — rejected — a lookup table of direction facts and pure helpers; data plus functions, no polymorphism.
//
// The app's single description of an encoder's turn directions. Everything
// that draws, labels, selects or writes a direction reads it from here, so the
// directions come from the firmware's neutral EncoderAction shape instead of a
// 'cw' | 'ccw' literal repeated across the stage, canvas and editor.
import type { EncoderAction, KeyAction } from '@firmware/types'

/** A turn direction: one key of the firmware's EncoderAction. */
export type EncoderDir = keyof EncoderAction

/** Which encoder, and which of its directions, the editor is on. */
export interface EncoderSelection {
    slot: number
    dir: EncoderDir
}

export interface EncoderDirInfo {
    dir: EncoderDir
    /** Chip label. */
    short: string
    /** Tooltips and accessible names. */
    long: string
    /** EncoderApi.setEncoder `direction` (0 = clockwise). */
    wire: 0 | 1
    /** Which half of the knob cap is this direction's hit zone. */
    side: 'left' | 'right'
}

const DIR_INFO = {
    ccw: {
        dir: 'ccw',
        short: 'CCW',
        long: 'Counter-clockwise',
        wire: 1,
        side: 'left',
    },
    cw: { dir: 'cw', short: 'CW', long: 'Clockwise', wire: 0, side: 'right' },
} as const satisfies Record<EncoderDir, EncoderDirInfo>

/** Every direction, in display order (left half → right half). */
export const ENCODER_DIRS: readonly EncoderDirInfo[] = Object.values(
    DIR_INFO,
).sort((a, b) => (a.side === b.side ? 0 : a.side === 'left' ? -1 : 1))

export function dirInfo(dir: EncoderDir): EncoderDirInfo {
    return DIR_INFO[dir]
}

/** The direction after `dir` in display order, or null on the last one.
 *  Drives the editor's auto-advance (CCW → CW). */
export function nextDir(dir: EncoderDir): EncoderDir | null {
    const i = ENCODER_DIRS.findIndex((d) => d.dir === dir)
    return ENCODER_DIRS[i + 1]?.dir ?? null
}

export function actionFor(enc: EncoderAction, dir: EncoderDir): KeyAction {
    return enc[dir]
}

// The stage delegates clicks from one listener and finds the target through a
// data attribute; these two keep its writer (the knob cap) and reader (the
// canvas) on one format.
export function encoderHitId(sel: EncoderSelection): string {
    return `${sel.slot}:${sel.dir}`
}

export function parseEncoderHitId(id: string): EncoderSelection | null {
    const [slot, dir] = id.split(':')
    const n = Number(slot)
    if (!Number.isInteger(n) || n < 0 || !(dir in DIR_INFO)) return null
    return { slot: n, dir: dir as EncoderDir }
}
