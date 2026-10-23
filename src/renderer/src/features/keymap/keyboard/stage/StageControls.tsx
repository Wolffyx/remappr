// pattern-check: skip — presentational heatmap legend extracted from KeyboardView
import { ArrowRight, RotateCcw } from 'lucide-react'
import useLoadStatsStore from '@/stores/loadStatsStore'

interface StageControlsProps {
    heatmapEnabled: boolean
    onResetHeat: () => void
}

// Heatmap legend (top-centre, matching the design): Less→More gradient, a reset,
// and a "View load stats" link that opens the Typing-load modal. The on/off toggles
// live in the header toolbar (Flame / Zap); the stage only reflects state.
export function StageControls({
    heatmapEnabled,
    onResetHeat,
}: StageControlsProps): JSX.Element | null {
    const openLoadStats = useLoadStatsStore((s) => s.setOpen)
    if (!heatmapEnabled) return null
    return (
        <div className="absolute top-[calc(var(--toolbar-h,0px)+0.875rem)] left-1/2 z-[15] flex -translate-x-1/2 items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-caption font-semibold text-muted-foreground shadow-sm">
            <span>Less</span>
            <span
                className="h-2 w-[110px] rounded-full"
                style={{
                    background:
                        'linear-gradient(90deg, oklch(0.34 0.07 250), oklch(0.5 0.16 286), oklch(0.62 0.22 20))',
                }}
            />
            <span>More</span>
            <button
                type="button"
                onClick={onResetHeat}
                title="Reset press counts"
                aria-label="Reset press counts"
                className="ml-0.5 rounded-full p-0.5 hover:text-foreground"
            >
                <RotateCcw className="size-3" />
            </button>
            <span className="mx-0.5 h-3.5 w-px bg-border" />
            <button
                type="button"
                onClick={(): void => openLoadStats(true)}
                className="inline-flex items-center gap-1 font-bold text-primary hover:underline"
            >
                View load stats
                <ArrowRight className="size-3" />
            </button>
        </div>
    )
}
