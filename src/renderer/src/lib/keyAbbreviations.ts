/**
 * Key/Layer name abbreviation utilities.
 *
 * Provides short, display-friendly forms for common key names and layer names
 * when rendering in space-constrained UI surfaces (e.g. small key caps).
 *
 * Callers should keep the original full name available for tooltips or
 * `aria-label` to preserve accessibility — these helpers only shorten the
 * visible text.
 */

const ELLIPSIS = '…'

/**
 * Map of full key names to their abbreviated display form.
 *
 * Keys are matched case-insensitively. Both common spellings (with/without
 * spaces or hyphens) are included where relevant.
 */
const KEY_ABBREVIATIONS: Readonly<Record<string, string>> = {
    backspace: 'BkSp',
    delete: 'Del',
    escape: 'Esc',
    'page up': 'PgUp',
    pageup: 'PgUp',
    'page down': 'PgDn',
    pagedown: 'PgDn',
    'left shift': 'LShft',
    lshift: 'LShft',
    'right shift': 'RShft',
    rshift: 'RShft',
    'left control': 'LCtrl',
    'left ctrl': 'LCtrl',
    lctrl: 'LCtrl',
    'right control': 'RCtrl',
    'right ctrl': 'RCtrl',
    rctrl: 'RCtrl',
    'left alt': 'LAlt',
    lalt: 'LAlt',
    'right alt': 'RAlt',
    ralt: 'RAlt',
    'left gui': 'LGui',
    lgui: 'LGui',
    'right gui': 'RGui',
    rgui: 'RGui',
    'caps lock': 'Caps',
    capslock: 'Caps',
    'num lock': 'Num',
    numlock: 'Num',
    'scroll lock': 'ScLk',
    scrolllock: 'ScLk',
    'print screen': 'PrSc',
    printscreen: 'PrSc',
    insert: 'Ins',
    home: 'Home',
    end: 'End',
    return: 'Ret',
    enter: 'Ent',
    // U+2294 (⊔), not U+2423 (␣): the open-box symbol has pathological font
    // metrics in the keycap font (renders ~4× tall, breaking cap layout); the
    // square-cup glyph reads the same and sizes normally. Matches the design.
    space: '⊔',
    tab: 'Tab',
    // Media (consumer page; "Keyboard Volume Up" arrives with the "Keyboard "
    // noun already stripped). Truncating these kept only "Volu…", which reads
    // the same for up and down — ambiguous on a knob's CCW/CW pair.
    'volume increment': 'Vol+',
    'volume decrement': 'Vol-',
    'volume up': 'Vol+',
    'volume down': 'Vol-',
    mute: 'Mute',
    'play/pause': 'Play',
    'scan next track': 'Next',
    'scan previous track': 'Prev',
    'display brightness increment': 'Bri+',
    'display brightness decrement': 'Bri-',
}

function truncateWithEllipsis(value: string, maxLength: number): string {
    if (maxLength <= 0) return ''
    if (value.length <= maxLength) return value
    if (maxLength === 1) return ELLIPSIS
    return value.slice(0, maxLength - 1) + ELLIPSIS
}

/**
 * Returns a short, display-friendly form of `name`.
 *
 * Lookup order:
 *   1. Case-insensitive match in {@link KEY_ABBREVIATIONS}.
 *   2. If `maxLength` is given and `name` exceeds it, truncate with ellipsis.
 *   3. Otherwise return `name` unchanged.
 *
 * The returned string is suitable for visible labels; callers should still
 * keep the original `name` for tooltips / `aria-label`.
 */
export function abbreviateKeyName(name: string, maxLength?: number): string {
    if (!name) return name

    const direct = KEY_ABBREVIATIONS[name.toLowerCase()]
    if (direct) {
        return maxLength !== undefined
            ? truncateWithEllipsis(direct, maxLength)
            : direct
    }

    if (maxLength !== undefined) {
        return truncateWithEllipsis(name, maxLength)
    }

    return name
}

/**
 * Returns a short, display-friendly form of a layer name.
 *
 * - Falls back to `L<index>` when no name is given.
 * - Truncates with ellipsis when the user-supplied name exceeds `maxLength`.
 */
export function abbreviateLayerName(
    name: string | undefined | null,
    layerIndex: number,
    maxLength: number = 5,
): string {
    const trimmed = name?.trim()
    if (!trimmed) return `L${layerIndex}`
    return truncateWithEllipsis(trimmed, maxLength)
}

/**
 * Returns the momentary-layer reference notation (e.g. `MO(2)`) used in ZMK
 * keymaps for layer activation bindings.
 */
export function formatMomentaryLayer(layerIndex: number): string {
    return `MO(${layerIndex})`
}
