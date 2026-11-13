// pattern-check: skip — pure geometry and naming helpers for the hue/saturation wheel
//
// The lighting colour wheel (design review f15, E1): hue runs round the wheel
// clockwise from the top, saturation from white in the middle to full colour
// at the rim. Brightness is not on the wheel: the firmware keeps it as its own
// value, set in the Brightness & speed step.

/** A colour as the lighting controls hold it: hue 0–360, saturation 0–100. */
export interface HueSat {
    hue: number
    saturation: number
}

/** Hue and saturation under a point of a wheel `size` px across. */
export function pointToHueSat(x: number, y: number, size: number): HueSat {
    const r = size / 2
    const [dx, dy] = [x - r, y - r]
    const deg = (Math.atan2(dx, -dy) * 180) / Math.PI
    return {
        hue: Math.round((deg + 360) % 360),
        saturation: Math.round(Math.min(1, Math.hypot(dx, dy) / r) * 100),
    }
}

/** Where a colour sits on a wheel `size` px across. */
export function hueSatToPoint(
    { hue, saturation }: HueSat,
    size: number,
): { x: number; y: number } {
    const r = size / 2
    const a = (hue * Math.PI) / 180
    const d = (r * Math.min(100, Math.max(0, saturation))) / 100
    return { x: r + Math.sin(a) * d, y: r - Math.cos(a) * d }
}

/** The light a colour gives at full brightness, for swatches (HSV with V = 1
 *  is HSL with S = 100% and L = 100% − saturation / 2). */
export const lightCss = ({ hue, saturation }: HueSat): string =>
    `hsl(${hue} 100% ${100 - saturation / 2}%)`

/** Named colours offered as one-click presets. */
export const PRESETS: readonly ({ name: string } & HueSat)[] = [
    { name: 'Red', hue: 0, saturation: 100 },
    { name: 'Orange', hue: 25, saturation: 100 },
    { name: 'Amber', hue: 42, saturation: 100 },
    { name: 'Yellow', hue: 58, saturation: 100 },
    { name: 'Lime', hue: 90, saturation: 100 },
    { name: 'Green', hue: 125, saturation: 100 },
    { name: 'Teal', hue: 170, saturation: 100 },
    { name: 'Ice blue', hue: 200, saturation: 45 },
    { name: 'Blue', hue: 225, saturation: 100 },
    { name: 'Purple', hue: 275, saturation: 100 },
    { name: 'Pink', hue: 320, saturation: 65 },
    { name: 'White', hue: 0, saturation: 0 },
]

const HUE_NAMES: readonly [number, string][] = [
    [0, 'red'],
    [25, 'orange'],
    [45, 'amber'],
    [60, 'yellow'],
    [90, 'lime'],
    [125, 'green'],
    [170, 'teal'],
    [195, 'cyan'],
    [225, 'blue'],
    [275, 'purple'],
    [300, 'magenta'],
    [330, 'pink'],
    [360, 'red'],
]

const hueGap = (a: number, b: number): number => {
    const d = Math.abs(a - b) % 360
    return Math.min(d, 360 - d)
}

/** A plain name for a colour: a preset's name when it is close to one, else
 *  the nearest hue word, "pale" when it is washed out, "white" near the middle. */
export function colourName(c: HueSat): string {
    const preset = PRESETS.find(
        (p) =>
            Math.abs(p.saturation - c.saturation) <= 6 &&
            (p.saturation === 0 || hueGap(p.hue, c.hue) <= 4),
    )
    if (preset) return preset.name
    if (c.saturation < 10) return 'White'
    const [, word] = HUE_NAMES.reduce((best, cur) =>
        hueGap(cur[0], c.hue) < hueGap(best[0], c.hue) ? cur : best,
    )
    const name = c.saturation < 55 ? `pale ${word}` : word
    return name.charAt(0).toUpperCase() + name.slice(1)
}
