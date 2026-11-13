// Pattern check: no GoF pattern (-) — rejected — a pure scan of a keymap's
// macros into readable warnings; one caller (the community item page).
//
// Before a config made by someone else lands on a keyboard, list its macros
// and flag the ones that drive the operating system: a GUI/Win/Cmd shortcut
// (GUI+R opens Run on Windows), Ctrl+Alt+Delete, or typing text and pressing
// Enter (which runs whatever was typed into a prompt).
import type { CanonMacro, CanonMacroStep, ConfigKeymap } from '@firmware/config'

export interface MacroReport {
    id: string
    description?: string
    steps: number
    /** Why this macro deserves a look; empty when nothing stands out. */
    warnings: string[]
}

const GUI_RE =
    /(^|[^A-Z])(L|R|LEFT_|RIGHT_)?(GUI|META|CMD|WIN|COMMAND)\b|\b[LR]G\(/i
const CTRL_RE = /CTRL|CONTROL|\b[LR]C\(/i
const ALT_RE = /ALT|OPT|\b[LR]A\(/i
const DEL_RE = /DEL(ETE)?\b/i
const ENTER_RE = /^(ENTER|RETURN|RET|KP_ENTER)$/i

function keyOf(step: CanonMacroStep): string | null {
    return 'key' in step ? String(step.key) : null
}

function warningsOf(macro: CanonMacro): string[] {
    const keys = macro.steps.map(keyOf).filter((k): k is string => !!k)
    const warnings: string[] = []
    const held = macro.steps.some(
        (s) => s.type === 'press' && GUI_RE.test(String(s.key)),
    )
    if (held || keys.some((k) => GUI_RE.test(k) && k.includes('(')))
        warnings.push('Uses a GUI / Win / Cmd shortcut')
    if (
        keys.some((k) => CTRL_RE.test(k)) &&
        keys.some((k) => ALT_RE.test(k)) &&
        keys.some((k) => DEL_RE.test(k))
    )
        warnings.push('Presses Ctrl+Alt+Delete')
    const typed = macro.steps.findIndex((s) => s.type === 'text')
    const runs =
        typed >= 0 &&
        macro.steps
            .slice(typed)
            .some(
                (s) =>
                    (s.type === 'text' && s.text.includes('\n')) ||
                    ENTER_RE.test(keyOf(s) ?? ''),
            )
    if (runs) warnings.push('Types text and presses Enter')
    return warnings
}

/** Every macro of the keymap with its warnings, flagged ones first. */
export function macroReport(config: ConfigKeymap): MacroReport[] {
    return (config.macros ?? [])
        .map((m) => ({
            id: m.id,
            description: m.description,
            steps: m.steps.length,
            warnings: warningsOf(m),
        }))
        .sort((a, b) => b.warnings.length - a.warnings.length)
}
