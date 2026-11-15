// Pattern check: Dispatch Map (Tier 0) — applied — key → editor action table for the device editor (undo, redo, Escape cascade, ⌘K assign).
import { useEffect } from 'react'
import undoRedoStore from '@/stores/undoRedoStore'
import useDeviceEditorStore from './deviceEditorStore'

/** Escape closes the innermost thing open: a pick, then a panel, then the
 *  selection. */
function escape(): void {
    const s = useDeviceEditorStore.getState()
    if (s.pick) return s.setPick(null)
    if (s.panelOpen) return s.setPanelOpen(false)
    s.select(null)
}

const isTyping = (t: EventTarget | null): boolean =>
    t instanceof HTMLElement &&
    (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))

/** Keyboard shortcuts of the device editor. `onAssign` is ⌘K (workspace C). */
export function useDeviceShortcuts(onAssign?: () => void): void {
    useEffect(() => {
        const withMod: Record<string, (shift: boolean) => void> = {
            z: (shift) =>
                void (shift
                    ? undoRedoStore.getState().redo()
                    : undoRedoStore.getState().undo()),
            y: () => void undoRedoStore.getState().redo(),
            k: () => onAssign?.(),
        }
        const onKey = (e: KeyboardEvent): void => {
            if (isTyping(e.target)) return
            // A dialog (palette, settings) owns its own keys.
            if (document.querySelector('[role="dialog"][data-state="open"]'))
                return
            if (e.key === 'Escape') return escape()
            if (!(e.metaKey || e.ctrlKey)) return
            const action = withMod[e.key.toLowerCase()]
            if (!action) return
            e.preventDefault()
            action(e.shiftKey)
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [onAssign])
}
