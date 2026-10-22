// pattern-check: skip — presentational Key Test legend overlay, mirrors StageControls
import { Check, RotateCcw } from 'lucide-react'

interface KeyTestPanelProps {
    /** Distinct positions seen pressed this sweep. */
    seenCount: number
    /** Total keys on the active physical layout (encoders excluded upstream). */
    total: number
    /** True when the firmware feeds the real switch matrix; false = OS-event
     *  fallback (focus-dependent, misses non-emitting keys). */
    hardware: boolean
    onReset: () => void
}

/** Top-centre legend for Key Test mode: progress (seen / total), a reset, and a
 *  note on the press source. Lives where StageControls does; shown only while the
 *  mode is active (KeyboardView gates rendering). */
export function KeyTestPanel({
    seenCount,
    total,
    hardware,
    onReset,
}: KeyTestPanelProps): JSX.Element {
    const done = total > 0 && seenCount >= total
    return (
        <div className="absolute top-3.5 left-1/2 z-[15] flex -translate-x-1/2 items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-caption font-semibold text-muted-foreground shadow-sm">
            {done ? (
                <span className="inline-flex items-center gap-1 text-success">
                    <Check className="size-3" /> All keys tested
                </span>
            ) : (
                <span>Press every key</span>
            )}
            <span className="mx-0.5 h-3.5 w-px bg-border" />
            <span className="tabular-nums text-foreground">
                {seenCount}
                <span className="text-muted-foreground"> / {total}</span>
            </span>
            <button
                type="button"
                onClick={onReset}
                title="Reset key test"
                aria-label="Reset key test"
                className="ml-0.5 rounded-full p-0.5 hover:text-foreground"
            >
                <RotateCcw className="size-3" />
            </button>
            <span className="mx-0.5 h-3.5 w-px bg-border" />
            <span
                className="text-meta font-medium"
                title={
                    hardware
                        ? 'Reading the keyboard switch matrix over the wire.'
                        : 'No hardware matrix channel — detecting OS key events (focus-dependent, misses non-emitting keys).'
                }
            >
                {hardware ? 'Hardware matrix' : 'OS events'}
            </span>
        </div>
    )
}
