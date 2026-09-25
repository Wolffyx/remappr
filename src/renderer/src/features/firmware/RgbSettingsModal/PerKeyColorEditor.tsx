// pattern-check: skip — per-key colour editor view bound to existing stores, no abstraction
import { useCallback, useEffect, useRef } from 'react'

import type { HsvColor } from '@firmware/service'
import usePerKeyPaintStore from '@/stores/perKeyPaintStore'
import { Button } from '@/ui/button'

import type { PaintApi } from '@/features/keymap/keyboard/stage/usePerKeyPaint'
import { ColorPicker } from './ColorPicker'

const COMMIT_DEBOUNCE_MS = 90

/** Select key(s) on the board, then colour them. Activates the device per-key
 *  mode (+ glow seeding) while mounted; edits coalesce into one debounced write. */
export function PerKeyColorEditor({
    paint,
    selectedKeyPosition,
    multiSelection,
}: {
    paint: PaintApi
    selectedKeyPosition: number | undefined
    multiSelection: Set<number>
}): JSX.Element {
    const colors = usePerKeyPaintStore((s) => s.colors)
    // usePerKeyPaint returns a fresh object each render but its functions are
    // memoized — depend on those (not `paint`) so the effects below don't thrash
    // active/commit on every colour-drag frame.
    const {
        available,
        volatile,
        brush,
        setActive,
        commitPaint,
        setBrush,
        onKeyPaint,
        fillAll,
        clearAll,
    } = paint

    // Activate per-key mode (seeds glow + switches the board to per-key) while the
    // section is shown; deactivate on leave so other glow sources resume.
    useEffect(() => {
        setActive(true)
        return (): void => setActive(false)
    }, [setActive])

    // Debounced device flush: dragging the picker updates glow every frame but
    // writes to the keyboard at most once per COMMIT_DEBOUNCE_MS (reuses the
    // coalescing queue in usePerKeyPaint — onKeyPaint queues, commitPaint flushes).
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
    const scheduleCommit = useCallback((): void => {
        if (timer.current) clearTimeout(timer.current)
        timer.current = setTimeout(() => commitPaint(), COMMIT_DEBOUNCE_MS)
    }, [commitPaint])
    useEffect(
        () => (): void => {
            if (timer.current) clearTimeout(timer.current)
            commitPaint() // flush any pending edit on unmount
        },
        [commitPaint],
    )

    const targets =
        multiSelection.size > 0
            ? [...multiSelection]
            : selectedKeyPosition != null
              ? [selectedKeyPosition]
              : []
    const primary = targets[0]
    const current: HsvColor =
        primary != null ? (colors[primary] ?? brush) : brush

    if (!available) {
        return (
            <div className="text-xs text-muted-foreground">
                Per-key RGB not exposed by this firmware build.
            </div>
        )
    }

    const apply = (next: HsvColor): void => {
        setBrush(next)
        for (const idx of targets) onKeyPaint(idx)
        scheduleCommit()
    }

    return (
        <div className="flex flex-col gap-3">
            <p className="text-[11.5px] leading-relaxed text-muted-foreground">
                Select one or more keys on the keyboard, then pick a colour.
                Cmd/Ctrl-click adds keys; Shift-click selects a range.
            </p>
            {volatile && (
                <p className="rounded-lg border border-dashed p-2 text-[11.5px] leading-relaxed text-muted-foreground">
                    This keyboard can&apos;t store per-key colours. They stay
                    until it&apos;s unplugged.
                </p>
            )}
            {targets.length === 0 ? (
                <div className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
                    No key selected — click a key on the board to colour it.
                </div>
            ) : (
                <div className="rounded-xl border p-3">
                    <div className="mb-2 text-xs font-semibold">
                        {targets.length === 1
                            ? `Key ${primary}`
                            : `${targets.length} keys selected`}
                    </div>
                    <ColorPicker value={current} onChange={apply} />
                </div>
            )}
            <div className="flex gap-2">
                <Button
                    size="sm"
                    variant="outline"
                    onClick={(): void => {
                        fillAll()
                    }}
                >
                    Fill all
                </Button>
                <Button
                    size="sm"
                    variant="outline"
                    onClick={(): void => {
                        clearAll()
                    }}
                >
                    Clear
                </Button>
            </div>
        </div>
    )
}
