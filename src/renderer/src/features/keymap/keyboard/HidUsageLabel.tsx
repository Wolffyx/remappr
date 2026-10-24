import { hidUsageLongLabel, usageGlyph } from '@/lib/actions/hidUsages'
import { glyphNode } from './keyGlyph'

// pattern-check: skip — additive optional render flag on existing props interface
export interface HidUsageLabelProps {
    hid_usage: number
    /** Suppress the inline modifier line (e.g. "CS") — used when the cap renders
     *  the chord modifiers as chips instead (KeyButton `mods`). */
    hideMods?: boolean
}

const MOD_LABELS: Array<[number, string, string]> = [
    [0x01, 'C', 'Left Ctrl'],
    [0x02, 'S', 'Left Shift'],
    [0x04, 'A', 'Left Alt'],
    [0x08, 'G', 'Left GUI'],
    [0x10, 'C', 'Right Ctrl'],
    [0x20, 'S', 'Right Shift'],
    [0x40, 'A', 'Right Alt'],
    [0x80, 'G', 'Right GUI'],
]

function activeMods(usage: number): Array<{ short: string; long: string }> {
    const flags = (usage >> 24) & 0xff
    if (!flags) return []
    return MOD_LABELS.filter(([b]) => flags & b).map(([, s, l]) => ({
        short: s,
        long: l,
    }))
}

export const HidUsageLabel = ({
    hid_usage,
    hideMods = false,
}: HidUsageLabelProps): JSX.Element => {
    const baseLong = hidUsageLongLabel(hid_usage)
    const mods = activeMods(hid_usage)
    const abbreviated = usageGlyph(hid_usage)
    const longTitle = mods.length
        ? mods.map((m) => m.long).join(' + ') + ' + ' + (baseLong ?? '')
        : baseLong

    return (
        <span
            className="inline-flex flex-col items-center justify-center leading-tight gap-px w-full"
            aria-label={longTitle}
            title={longTitle}
        >
            {!hideMods && mods.length > 0 && (
                <span className="flex gap-px justify-center text-[0.45em] font-bold opacity-80 leading-none tracking-tight">
                    {mods.map((m, i) => (
                        <span key={i}>{m.short}</span>
                    ))}
                </span>
            )}
            {abbreviated && (
                <span className="font-bold inline-flex items-center">
                    {glyphNode(abbreviated)}
                </span>
            )}
        </span>
    )
}
