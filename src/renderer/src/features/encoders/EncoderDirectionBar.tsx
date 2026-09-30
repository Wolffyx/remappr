// Pattern check: no GoF pattern (-) — rejected — presentational chips driven by the direction table; props in, callbacks out.
//
// Direction chips for the selected encoder, styled like the mod-tap SlotBar and
// rendered inline in the picker's header row, after the type dropdown. One chip
// per direction in ENCODER_DIRS shows its binding; the active chip is the one
// the picker edits. Clicking a knob half on the stage selects the same chip —
// both go through the one EncoderSelection.
import { ArrowLeftRight } from 'lucide-react'
import { Button } from '@/ui/button'
import { LegendParts } from '@/features/keymap/keyboard/LegendParts'
import type { KnobLegend, KnobSide } from './knobLegend'
import { ENCODER_DIRS, type EncoderDir } from './model'

function SideValue({ side }: { side: KnobSide }): JSX.Element {
    if (side.parts) return <LegendParts parts={side.parts} title={side.title} />
    if (side.text) return <span title={side.title}>{side.text}</span>
    return <span className="text-xs text-muted-foreground italic">—</span>
}

interface EncoderDirectionBarProps {
    legend: KnobLegend
    activeDir: EncoderDir
    onActivate: (dir: EncoderDir) => void
    /** Omitted when the encoder can't be edited. */
    onSwap?: () => void
}

export function EncoderDirectionBar({
    legend,
    activeDir,
    onActivate,
    onSwap,
}: EncoderDirectionBarProps): JSX.Element {
    return (
        <div className="flex flex-row flex-wrap items-center gap-2">
            {ENCODER_DIRS.map(({ dir, short, long }) => {
                const active = dir === activeDir
                return (
                    <button
                        key={dir}
                        type="button"
                        title={long}
                        aria-pressed={active}
                        onClick={() => onActivate(dir)}
                        className={`flex items-center gap-2 rounded-md border-2 bg-card px-3 py-1.5 transition-colors hover:bg-accent/30 ${
                            active
                                ? 'ring-2 ring-primary border-primary'
                                : 'border-border'
                        }`}
                    >
                        <span className="text-xs uppercase tracking-wide text-muted-foreground">
                            {short}
                        </span>
                        <span className="min-w-[2.5em] text-sm text-foreground">
                            <SideValue side={legend[dir]} />
                        </span>
                    </button>
                )
            })}
            {onSwap && (
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={onSwap}
                    title="Swap the turn directions' bindings"
                >
                    <ArrowLeftRight className="h-4 w-4" />
                    Swap
                </Button>
            )}
        </div>
    )
}
