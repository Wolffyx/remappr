// Pattern check: Dispatch Map (Tier 0) — applied — control kind → inspector sections table; a section shows when the adapter honours any of its fields.
//
// Which inspector sections a control gets. The adapter's `fields` table is its
// capability: a section whose fields it does not honour is not shown at all.
import type {
    BindingByKind,
    ControlFieldSupport,
    ControlKind,
} from '@firmware/devices/types'

export type SectionId =
    | 'tap'
    | 'hold'
    | 'behaviour'
    | 'directions'
    | 'feel'
    | 'output'
    | 'deadzone'
    | 'curve'
    | 'click'
    | 'travel'
    | 'mode'
    | 'stages'
    | 'poll'
    | 'tracking'
    | 'rotation'
    | 'response'

type SectionTable = {
    readonly [K in ControlKind]: readonly (readonly [
        SectionId,
        readonly (keyof BindingByKind[K])[],
    ])[]
}

const SECTIONS: SectionTable = {
    button: [
        ['tap', ['a']],
        ['hold', ['hold']],
        ['behaviour', ['turbo', 'toggle']],
    ],
    wheel: [
        ['directions', ['up', 'down', 'click', 'tl', 'tr']],
        ['feel', ['lines', 'smooth', 'freeSpin']],
    ],
    stick: [
        ['output', ['out']],
        ['deadzone', ['inner', 'outer']],
        ['curve', ['curve', 'invY']],
        ['click', ['click']],
    ],
    trigger: [
        ['output', ['out']],
        ['travel', ['mode', 'start', 'end', 'rumble']],
    ],
    hat: [
        ['mode', ['ways']],
        ['directions', ['up', 'down', 'left', 'right', 'ul', 'ur', 'dl', 'dr']],
    ],
    sensor: [
        ['stages', ['stages', 'active']],
        ['poll', ['poll']],
        ['tracking', ['lod', 'snap', 'motionSync']],
    ],
    encoder: [
        ['rotation', ['cw', 'ccw', 'press']],
        ['feel', ['sens']],
    ],
    axis: [
        ['output', ['out']],
        ['response', ['curve', 'dz', 'inv']],
    ],
}

/** Whether the adapter honours `field` of a `kind` binding. */
export function supportsField<K extends ControlKind>(
    fields: ControlFieldSupport,
    kind: K,
    field: keyof BindingByKind[K],
): boolean {
    const list = fields[kind] as readonly (keyof BindingByKind[K])[] | undefined
    return !!list?.includes(field)
}

/** The inspector sections of a `kind` control, in display order. */
export function visibleSections<K extends ControlKind>(
    kind: K,
    fields: ControlFieldSupport,
): SectionId[] {
    const table = SECTIONS[kind] as SectionTable[K]
    return table
        .filter(([, fs]) => fs.some((f) => supportsField(fields, kind, f)))
        .map(([id]) => id)
}
