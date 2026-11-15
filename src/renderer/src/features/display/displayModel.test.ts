// pattern-check: skip — unit tests for the display editor's model
import { describe, expect, it } from 'vitest'
import type { ScreenPanel } from '@firmware/service'
import type { ConfigDisplay } from '@firmware/config/types'
import { buildScreensApi } from '@firmware/clients/remappr/screens'
import {
    clampWidget,
    defaultPage,
    displayProblems,
    invertOf,
    logicalOf,
    newWidget,
    rotationOf,
    rowSettings,
    widgetAt,
    withDefaultPage,
    withDisplay,
} from './displayModel'

const screens = buildScreensApi(undefined)
const panel = (rotation = 0): ScreenPanel =>
    ({
        part: 2,
        model: 'SH1106',
        width: 128,
        height: 64,
        info: {
            settings: [
                { name: 'rotation', value: rotation },
                { name: 'invert', value: false },
            ],
        },
    }) as unknown as ScreenPanel

describe('display model', () => {
    it("reads rotation / invert from the document, else the part's value", () => {
        expect(rotationOf(panel(2), undefined)).toBe(2)
        const d: ConfigDisplay = {
            part: 2,
            pages: [],
            settings: { rotation: 1, invert: true },
        }
        expect(rotationOf(panel(2), d)).toBe(1)
        expect(invertOf(panel(), d)).toBe(true)
        expect(logicalOf(screens, panel(), d)).toEqual({
            width: 64,
            height: 128,
        })
    })

    it('keeps only number / boolean settings for the rows', () => {
        expect(
            rowSettings({ brightness: 40, invert: true, rotation: 'deg90' }),
        ).toEqual({
            brightness: 40,
            invert: true,
        })
    })

    it('drops a display left as one empty page, keeps parts in order', () => {
        const a: ConfigDisplay = {
            part: 3,
            pages: [{ widgets: [newWidget('rect', 128, 64)] }],
        }
        const b: ConfigDisplay = {
            part: 1,
            pages: [{ widgets: [newWidget('text', 128, 64)] }],
        }
        expect(withDisplay([a], b).map((d) => d.part)).toEqual([1, 3])
        expect(
            withDisplay([a, b], { part: 3, pages: [{ widgets: [] }] }),
        ).toEqual([b])
        expect(
            withDisplay([a], {
                part: 3,
                pages: [{ widgets: [] }],
                settings: { invert: true },
            }),
        ).toHaveLength(1)
    })

    it('moves the default page', () => {
        const d: ConfigDisplay = {
            part: 0,
            pages: [{ default: true, widgets: [] }, { widgets: [] }],
        }
        expect(defaultPage(d)).toBe(0)
        const moved = withDefaultPage(d, 1)
        expect(defaultPage(moved)).toBe(1)
        expect(moved.pages[0]).toEqual({ widgets: [] })
    })

    it('new widgets fit the panel; a box is clamped into it', () => {
        expect(newWidget('text', 64, 128)).toMatchObject({ x: 0, y: 0, w: 64 })
        expect(newWidget('image', 8, 8).image).toEqual({
            width: 8,
            height: 8,
            data: btoa('\0'.repeat(8)),
        })
        expect(
            clampWidget(
                { kind: 'rect', x: 200, y: 10, w: 50, h: 100 },
                128,
                64,
            ),
        ).toEqual({
            kind: 'rect',
            x: 127,
            y: 10,
            w: 1,
            h: 54,
        })
    })

    it('picks the topmost widget under a pixel', () => {
        const page = {
            widgets: [
                { kind: 'rect' as const, x: 0, y: 0, w: 20, h: 20 },
                { kind: 'rect' as const, x: 10, y: 10, w: 5, h: 5 },
            ],
        }
        expect(widgetAt(page, 12, 12)).toBe(1)
        expect(widgetAt(page, 2, 2)).toBe(0)
        expect(widgetAt(page, 50, 50)).toBe(-1)
    })

    it('files the problems under their widget', () => {
        const d: ConfigDisplay[] = [
            {
                part: 4,
                pages: [
                    {
                        widgets: [
                            {
                                kind: 'value',
                                x: 0,
                                y: 0,
                                w: 8,
                                h: 8,
                                source: 'nope',
                            },
                        ],
                    },
                ],
            },
        ]
        expect([...displayProblems(screens, d).keys()]).toEqual(['4/0/0'])
    })
})
