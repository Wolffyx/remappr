// Pattern check: no GoF pattern (-) — rejected — the editor's zoom HUD markup
// extracted so the builder canvas shows the very same control.
//
// The zoom control in a canvas's top-right corner: zoom out, the live zoom
// (100% = fitted), zoom in, reset. The keymap editor and the builder share it.
import type { PropsWithChildren } from 'react'
import { Maximize2, Minus, Plus } from 'lucide-react'

function ZoomButton({
    label,
    onClick,
    children,
}: PropsWithChildren<{ label: string; onClick: () => void }>): JSX.Element {
    return (
        <button
            type="button"
            aria-label={label}
            title={label}
            onClick={onClick}
            className="flex size-7 items-center justify-center rounded-md text-foreground hover:bg-accent transition-colors"
        >
            {children}
        </button>
    )
}

export function ZoomHud({
    zoom,
    onZoomBy,
    onReset,
}: {
    /** 1 = fitted. */
    zoom: number
    onZoomBy: (factor: number) => void
    onReset: () => void
}): JSX.Element {
    return (
        <div
            data-zoomhud="true"
            role="toolbar"
            aria-label="Zoom"
            className="absolute top-3 right-3 z-20 flex items-center gap-1 rounded-lg border border-border bg-card px-1 py-1 shadow-sm"
            onPointerDown={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onDoubleClick={(e) => e.stopPropagation()}
        >
            <ZoomButton label="Zoom out" onClick={() => onZoomBy(1 / 1.15)}>
                <Minus className="size-4" />
            </ZoomButton>
            <span className="min-w-12 text-center text-xs font-mono tabular-nums text-muted-foreground">
                {Math.round(zoom * 100)}%
            </span>
            <ZoomButton label="Zoom in" onClick={() => onZoomBy(1.15)}>
                <Plus className="size-4" />
            </ZoomButton>
            <ZoomButton label="Reset view" onClick={onReset}>
                <Maximize2 className="size-4" />
            </ZoomButton>
        </div>
    )
}
