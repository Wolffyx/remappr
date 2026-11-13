// Pattern check: no GoF pattern (-) — rejected — pure helpers over ConfigDisplay (defaults per kind as a Dispatch Map, Tier 0).
//
// The display editor's model: a display's rotation and size as its settings
// leave it, the document's pages per display, a new widget of each kind that
// fits the panel, and the problems the device would refuse, per widget.
import type { SensorSettingValue } from '@firmware/devices/types'
import type { ScreenPanel, ScreensApi } from '@firmware/service'
import type {
    ConfigDisplay,
    ConfigScreenPage,
    ConfigScreenWidget,
    ConfigSensorValue,
} from '@firmware/config/types'

export type WidgetKind = ConfigScreenWidget['kind']

/** A setting's value in force: the document's (a number or boolean; an
 *  option written by name is left to the device) else the part's own. */
function settingOf(
    panel: ScreenPanel,
    d: ConfigDisplay | undefined,
    name: string,
): number {
    const set = d?.settings?.[name]
    const v =
        typeof set === 'number' || typeof set === 'boolean'
            ? set
            : panel.info.settings.find((x) => x.name === name)?.value
    return Number(v ?? 0)
}

/** The rotation a display shows with (clockwise quarter turns). */
export const rotationOf = (
    panel: ScreenPanel,
    d: ConfigDisplay | undefined,
): number => settingOf(panel, d, 'rotation') & 3

export const invertOf = (
    panel: ScreenPanel,
    d: ConfigDisplay | undefined,
): boolean => settingOf(panel, d, 'invert') !== 0

/** The size widgets see on @p panel with its rotation. */
export function logicalOf(
    screens: ScreensApi,
    panel: ScreenPanel,
    d: ConfigDisplay | undefined,
): { width: number; height: number } {
    return screens.logicalSize(panel.width, panel.height, rotationOf(panel, d))
}

/** Document settings -> what the generic setting rows take (numbers and
 *  booleans; an option written by name is not shown as set). */
export function rowSettings(
    settings: Readonly<Record<string, ConfigSensorValue>> | undefined,
): Record<string, SensorSettingValue> {
    const out: Record<string, SensorSettingValue> = {}
    for (const [k, v] of Object.entries(settings ?? {})) {
        if (typeof v !== 'string') out[k] = v
    }
    return out
}

/** The display of @p part in @p displays, or a new one with an empty page. */
export function displayOf(
    displays: readonly ConfigDisplay[],
    part: number,
): ConfigDisplay {
    return (
        displays.find((d) => d.part === part) ?? {
            part,
            pages: [{ widgets: [] }],
        }
    )
}

/** @p displays with the display of `next.part` replaced (or added, in part
 *  order). A display left as one empty page and no settings is dropped, so
 *  the device keeps its own content there. */
export function withDisplay(
    displays: readonly ConfigDisplay[],
    next: ConfigDisplay,
): ConfigDisplay[] {
    const rest = displays.filter((d) => d.part !== next.part)
    const empty =
        next.pages.length === 1 &&
        next.pages[0].widgets.length === 0 &&
        Object.keys(next.settings ?? {}).length === 0
    const all = empty ? rest : [...rest, next]
    return all.sort((a, b) => a.part - b.part)
}

/** The page shown first: the default one, else the first. */
export const defaultPage = (d: ConfigDisplay): number =>
    Math.max(
        0,
        d.pages.findIndex((p) => p.default),
    )

/** Make page @p i the one shown first. */
export function withDefaultPage(d: ConfigDisplay, i: number): ConfigDisplay {
    return {
        ...d,
        pages: d.pages.map((p, pi) => {
            const rest: ConfigScreenPage = { ...p }
            delete rest.default
            return pi === i ? { ...rest, default: true } : rest
        }),
    }
}

export function withPage(
    d: ConfigDisplay,
    i: number,
    page: ConfigScreenPage,
): ConfigDisplay {
    return { ...d, pages: d.pages.map((p, pi) => (pi === i ? page : p)) }
}

/* Kind -> a new widget of that kind in a w x h panel (Dispatch Map). */
const NEW_WIDGET: Record<
    WidgetKind,
    (w: number, h: number) => ConfigScreenWidget
> = {
    text: (w) => ({ kind: 'text', x: 0, y: 0, w, h: 8, text: 'Hello' }),
    value: (w) => ({ kind: 'value', x: 0, y: 0, w, h: 8, source: 'battery' }),
    bar: (w) => ({
        kind: 'bar',
        x: 0,
        y: 0,
        w,
        h: 6,
        source: 'battery',
        max: 100,
    }),
    image: (w, h) => {
        const side = Math.min(16, w, h)
        return {
            kind: 'image',
            x: 0,
            y: 0,
            w: side,
            h: side,
            image: { width: side, height: side, data: blankImage(side, side) },
        }
    },
    clock: (w) => ({
        kind: 'clock',
        x: 0,
        y: 0,
        w,
        h: 16,
        font: 'large',
        format: 'hm',
        align: 'centre',
    }),
    rect: () => ({ kind: 'rect', x: 0, y: 0, w: 16, h: 8, frame: true }),
}

/** A blank w x h image's base64 rows. */
export function blankImage(w: number, h: number): string {
    return btoa('\0'.repeat(Math.ceil(w / 8) * h))
}

/** A new @p kind widget sized to fit a w x h panel (at most 255 px, a
 *  widget's u8 size). */
export function newWidget(
    kind: WidgetKind,
    w: number,
    h: number,
): ConfigScreenWidget {
    return NEW_WIDGET[kind](Math.min(w, 255), Math.min(h, 255))
}

/** Keeps a widget's box inside the w x h panel and its u8 fields. */
export function clampWidget(
    wd: ConfigScreenWidget,
    w: number,
    h: number,
): ConfigScreenWidget {
    const x = Math.max(0, Math.min(wd.x, w - 1, 255))
    const y = Math.max(0, Math.min(wd.y, h - 1, 255))
    return {
        ...wd,
        x,
        y,
        w: Math.max(1, Math.min(wd.w, w - x, 255)),
        h: Math.max(1, Math.min(wd.h, h - y, 255)),
    }
}

/** The compiler's problems for @p displays: per widget by
 *  `display/page/widget`, the rest (limits) under ''. */
export function displayProblems(
    screens: ScreensApi,
    displays: readonly ConfigDisplay[],
): Map<string, string[]> {
    const out = new Map<string, string[]>()
    for (const p of screens.problems(displays)) {
        const [di, , pi, , wi] = p.path
        const key =
            p.path.length >= 5
                ? `${displays[Number(di)]?.part}/${String(pi)}/${String(wi)}`
                : ''
        out.set(key, [...(out.get(key) ?? []), p.message])
    }
    return out
}

/** The topmost widget of @p page under logical pixel (x, y), or -1. */
export function widgetAt(page: ConfigScreenPage, x: number, y: number): number {
    for (let i = page.widgets.length - 1; i >= 0; i--) {
        const w = page.widgets[i]
        if (x >= w.x && x < w.x + w.w && y >= w.y && y < w.y + w.h) return i
    }
    return -1
}
