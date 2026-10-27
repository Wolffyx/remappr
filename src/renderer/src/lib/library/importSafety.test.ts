// pattern-check: skip — unit tests for the macro scan
import { describe, expect, it } from 'vitest'
import type { ConfigKeymap } from '@firmware/config'
import { macroReport } from './importSafety'

const keymap = (macros: ConfigKeymap['macros']): ConfigKeymap =>
    ({ macros }) as ConfigKeymap

describe('macroReport', () => {
    it('flags GUI shortcuts and type-then-enter', () => {
        const report = macroReport(
            keymap([
                { id: 'plain', steps: [{ type: 'tap', key: 'A' }] },
                {
                    id: 'run',
                    steps: [
                        { type: 'press', key: 'LEFT_GUI' },
                        { type: 'tap', key: 'R' },
                        { type: 'release', key: 'LEFT_GUI' },
                        { type: 'text', text: 'powershell' },
                        { type: 'tap', key: 'ENTER' },
                    ],
                },
            ]),
        )
        expect(report[0]).toMatchObject({
            id: 'run',
            warnings: [
                'Uses a GUI / Win / Cmd shortcut',
                'Types text and presses Enter',
            ],
        })
        expect(report[1]).toMatchObject({ id: 'plain', warnings: [] })
    })

    it('flags Ctrl+Alt+Delete and lists nothing without macros', () => {
        const [cad] = macroReport(
            keymap([
                {
                    id: 'cad',
                    steps: [
                        { type: 'press', key: 'LEFT_CONTROL' },
                        { type: 'press', key: 'LEFT_ALT' },
                        { type: 'tap', key: 'DELETE' },
                    ],
                },
            ]),
        )
        expect(cad.warnings).toContain('Presses Ctrl+Alt+Delete')
        expect(macroReport(keymap(undefined))).toEqual([])
    })
})
