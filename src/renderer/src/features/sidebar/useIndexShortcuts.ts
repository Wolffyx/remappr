// Pattern check: no GoF pattern (-) — rejected — one keydown hook shared by the layer and profile lists; a two-entry key table.
import { useEffect } from 'react'

const STEP: Readonly<Record<string, number>> = {
    BracketLeft: -1,
    BracketRight: 1,
}

/** ⌥1–⌥9 pick a layer (or profile), ⌥[ and ⌥] step through them. Physical key codes, so
 *  the macOS ⌥ characters don't matter; ignored while typing. */
export function useIndexShortcuts(
    count: number,
    selected: number,
    select: (index: number) => void,
): void {
    useEffect(() => {
        const onKey = (e: KeyboardEvent): void => {
            if (!e.altKey || e.metaKey || e.ctrlKey || count === 0) return
            const t = e.target
            if (
                t instanceof HTMLInputElement ||
                t instanceof HTMLTextAreaElement
            )
                return
            const step = STEP[e.code]
            const digit = /^Digit([1-9])$/.exec(e.code)
            const next =
                step !== undefined
                    ? (selected + step + count) % count
                    : digit
                      ? Number(digit[1]) - 1
                      : null
            if (next === null || next >= count) return
            e.preventDefault()
            select(next)
        }
        window.addEventListener('keydown', onKey)
        return (): void => window.removeEventListener('keydown', onKey)
    }, [count, selected, select])
}
