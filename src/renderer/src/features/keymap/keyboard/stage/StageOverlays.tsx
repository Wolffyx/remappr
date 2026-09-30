// pattern-check: skip — presentational stage overlays extracted from KeyboardView
import { Eraser, Eye, SquarePen, Wand2, X } from 'lucide-react'
import { CATEGORY_META, layerAccent } from '@/lib/keymap/keyCategory'
import { KeyCapPreview } from '../KeyCapPreview'
import type { KeyPosition } from '../PhysicalLayoutCanvas'

/** Top-left cluster: current-layer pill (accent dot + glow) + pulsing LIVE chip. */
export function LayerPill({
    displayLayerIndex,
    layerName,
    liveView,
}: {
    displayLayerIndex: number
    layerName: string
    liveView: boolean
}): JSX.Element {
    const accent = layerAccent(displayLayerIndex)
    return (
        <div className="absolute top-3.5 left-4 z-10 flex items-center gap-2.5">
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-[13px] font-bold shadow-sm">
                <span
                    aria-hidden
                    className="size-[9px] rounded-[3px]"
                    style={{
                        background: accent,
                        boxShadow: `0 0 8px ${accent}`,
                    }}
                />
                {layerName}
                <span className="text-xs font-medium text-muted-foreground">
                    layer
                </span>
            </span>
            {liveView && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-green-500/40 bg-green-500/15 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.04em] text-green-600 dark:text-green-400">
                    <span className="relative flex size-[7px]">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-500 opacity-75" />
                        <span className="relative inline-flex size-[7px] rounded-full bg-green-500" />
                    </span>
                    LIVE
                </span>
            )}
        </div>
    )
}

/** Hover-peek banner (top-centre), tinted by the peeked layer's accent. */
export function PeekBanner({
    displayLayerIndex,
    layerName,
}: {
    displayLayerIndex: number
    layerName: string
}): JSX.Element {
    const accent = layerAccent(displayLayerIndex)
    return (
        <div
            className="absolute top-3.5 left-1/2 z-[16] inline-flex -translate-x-1/2 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold text-foreground"
            style={{
                background: `color-mix(in oklch, ${accent} 20%, var(--card))`,
                borderColor: accent,
            }}
        >
            <Eye className="size-3.5" /> Previewing {layerName}
        </div>
    )
}

/** Floating selected-key card (bottom-left): tinted preview + Edit button. */
export function SelectedKeyCard({
    info,
    layerName,
    onEdit,
}: {
    info: KeyPosition
    layerName: string
    onEdit: () => void
}): JSX.Element {
    return (
        <div className="fade-in absolute bottom-4 left-4 z-10 flex items-center gap-3 rounded-xl border border-border bg-card px-3.5 py-2.5 shadow-lg">
            <KeyCapPreview info={info} />
            <div className="text-xs leading-tight">
                <div className="font-semibold text-foreground">
                    {info.header}
                </div>
                <div className="text-muted-foreground">
                    {CATEGORY_META[info.category ?? 'alpha']?.label} ·{' '}
                    {layerName} layer
                </div>
            </div>
            <button
                type="button"
                onClick={onEdit}
                className="ml-1 inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90"
            >
                <SquarePen className="size-3.5" /> Edit
            </button>
        </div>
    )
}

/** Bottom-centre multi-selection action bar. */
export function MultiSelectBar({
    count,
    onAssign,
    onClear,
    clearDisabled,
    onDismiss,
}: {
    count: number
    onAssign: () => void
    onClear: () => void
    clearDisabled: boolean
    onDismiss: () => void
}): JSX.Element {
    return (
        <div className="absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 items-center gap-2 rounded-full border border-border bg-background/90 px-2 py-1.5 shadow-lg backdrop-blur">
            <span className="px-1.5 text-xs font-medium text-muted-foreground">
                {count} selected
            </span>
            <button
                type="button"
                onClick={onAssign}
                className="flex items-center gap-1.5 rounded-full bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground hover:opacity-90"
            >
                <Wand2 className="size-3.5" /> Assign
            </button>
            <button
                type="button"
                onClick={onClear}
                disabled={clearDisabled}
                title="Clear bindings (Delete)"
                className="flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-xs font-medium text-foreground hover:bg-accent disabled:opacity-40"
            >
                <Eraser className="size-3.5" /> Clear
            </button>
            <button
                type="button"
                onClick={onDismiss}
                aria-label="Dismiss selection"
                title="Dismiss selection (Esc)"
                className="flex size-6 items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground"
            >
                <X className="size-3.5" />
            </button>
        </div>
    )
}
