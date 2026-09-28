// Pattern check: no GoF pattern (-) — rejected — presentational mapper from cached PreviewKey[]
// + encoder slots (or a generic fallback board) to PhysicalLayoutCanvas positions; no abstraction.
import {
    PhysicalLayoutCanvas,
    type KeyPosition,
} from '@/features/keymap/keyboard/PhysicalLayoutCanvas'
import type { KeyCategory } from '@/lib/keymap/keyCategory'
import type { KnobLegend } from '@/features/encoders/knobLegend'
import { ENCODER_DIRS } from '@/features/encoders/model'
import type { PreviewEncoder, PreviewKey } from '@/stores/devicePreviewStore'

// A generic split-ish 3×5 cluster used purely as a visual flourish when no real
// layout has been cached yet (device never connected).
const ROW_CATEGORIES: KeyCategory[][] = [
    ['num', 'alpha', 'alpha', 'alpha', 'nav'],
    ['mod', 'alpha', 'alpha', 'alpha', 'edit'],
    ['layer', 'alpha', 'alpha', 'punct', 'system'],
]

const MINI_POSITIONS: KeyPosition[] = ROW_CATEGORIES.flatMap((row, y) =>
    row.map((category, x) => ({
        id: `mini-${y}-${x}`,
        x,
        y,
        width: 1,
        height: 1,
        category,
    })),
)

// Caps are blank: the card shows the board's shape and colour categories,
// never what the keys are bound to.
function toPositions(
    keys: PreviewKey[],
    encoders: PreviewEncoder[],
): KeyPosition[] {
    const caps = keys.map(
        (k, i): KeyPosition => ({
            id: `prev-${i}`,
            x: k.x,
            y: k.y,
            width: k.width,
            height: k.height,
            r: k.r,
            rx: k.rx,
            ry: k.ry,
            category: k.category,
        }),
    )
    const knobs = encoders.map(
        (e, slot): KeyPosition => ({
            id: `prev-enc-${slot}`,
            x: e.x,
            y: e.y,
            width: 1,
            height: 1,
            knob: blankKnob(slot),
        }),
    )
    return [...caps, ...knobs]
}

const blankKnob = (slot: number): KnobLegend =>
    Object.assign(
        { slot },
        ...ENCODER_DIRS.map(({ dir }) => ({
            [dir]: { text: '', category: 'alpha' },
        })),
    ) as KnobLegend

interface MiniKeyboardPreviewProps {
    /** Cached real base-layer keys; when omitted a generic board is drawn. */
    keys?: PreviewKey[]
    /** Cached encoder slots, drawn as blank knobs. */
    encoders?: PreviewEncoder[]
    oneU?: number
}

export function MiniKeyboardPreview({
    keys,
    encoders = [],
    oneU = 14,
}: MiniKeyboardPreviewProps): JSX.Element {
    const positions =
        keys && keys.length > 0 ? toPositions(keys, encoders) : MINI_POSITIONS
    return (
        <div
            className="pointer-events-none leading-[0]"
            style={{
                maskImage:
                    'radial-gradient(130% 130% at 50% 50%, #000 72%, transparent)',
                WebkitMaskImage:
                    'radial-gradient(130% 130% at 50% 50%, #000 72%, transparent)',
            }}
        >
            <PhysicalLayoutCanvas
                positions={positions}
                oneU={oneU}
                hoverZoom={false}
                capStyleOverride="sculpted"
                colorModeOverride="subtle"
                showHeaderTag={false}
                showCategoryDot={false}
            />
        </div>
    )
}
