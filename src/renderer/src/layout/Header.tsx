// pattern-check: skip — layout shell delegating to toolbar clusters, no abstraction
//
// The header shell: brand on the left, three tool clusters on the right.
//
// Each cluster (layout/toolbar/) owns its own store subscriptions, so a heatmap
// toggle no longer re-renders the save pill and an undo push no longer re-renders
// the dialog buttons. What stays here is genuinely header-level: window chrome,
// the brand button and the cluster order.
import { Blocks, Keyboard } from 'lucide-react'

import useBuilderStore from '@/stores/builderStore'
import useConnectionStore from '@/stores/connectionStore'
import { SidebarTrigger, useSidebar } from '@/ui/sidebar'
import { Separator } from '@/ui/separator'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/ui/tooltip'
import { ViewTools } from '@/layout/toolbar/ViewTools'
import { ConfigTools } from '@/layout/toolbar/ConfigTools'
import { HistoryTools } from '@/layout/toolbar/HistoryTools'
import { WindowControls } from '@/layout/WindowControls'
import { TrafficLightInset } from '@/layout/TrafficLightInset'

const noDrag = { WebkitAppRegion: 'no-drag' } as React.CSSProperties

export function Header(): JSX.Element {
    const { state: sidebarState } = useSidebar()
    const disconnect = useConnectionStore((s) => s.disconnect)
    // Only when the editor was reached via the builder's "Editor" handoff do we
    // offer a way back. A directly-connected device never shows this.
    const cameFromBuilder = useBuilderStore((s) => s.cameFromBuilder)
    const returnToBuilder = useBuilderStore((s) => s.returnToBuilder)

    return (
        <header
            className="flex h-(--header-height) shrink-0 select-none items-center gap-1 border-b bg-card pl-2 transition-[width,height] ease-linear"
            style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
        >
            {/* With the sidebar open, the window's top-left corner (and the
                macOS traffic lights over it) belongs to the Drawer — only when
                it's collapsed does this header reach the window edge and need
                to clear them itself (no-op on Windows/Linux). */}
            {sidebarState === 'collapsed' && <TrafficLightInset />}

            {/* ===== left: sidebar toggle + brand ===== */}
            <div className="flex items-center gap-1" style={noDrag}>
                <SidebarTrigger />
                <Tooltip>
                    <TooltipTrigger asChild>
                        <button
                            type="button"
                            onClick={disconnect}
                            className="flex items-center gap-2 rounded-lg border border-transparent px-2 py-1 text-foreground transition-colors hover:bg-accent"
                        >
                            <span className="grid size-7 place-items-center rounded-md bg-[linear-gradient(150deg,var(--primary),color-mix(in_oklch,var(--primary)_65%,#000))] text-white">
                                <Keyboard className="size-4" />
                            </span>
                            <span className="text-[14.5px] font-bold">
                                Remappr
                            </span>
                        </button>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>Back to devices</p>
                    </TooltipContent>
                </Tooltip>
                {cameFromBuilder && (
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <button
                                type="button"
                                onClick={returnToBuilder}
                                className="flex items-center gap-1.5 rounded-lg border border-border px-2 py-1 text-[13px] font-semibold text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                            >
                                <Blocks className="size-4" />
                                Builder
                            </button>
                        </TooltipTrigger>
                        <TooltipContent>
                            <p>Back to Builder</p>
                        </TooltipContent>
                    </Tooltip>
                )}
            </div>

            {/* draggable spacer */}
            <div className="h-full flex-1" />

            {/* ===== right: tool clusters + window controls ===== */}
            <div
                className="flex items-center gap-1 pr-1"
                data-coach="tools"
                style={noDrag}
            >
                <ViewTools />
                <Separator
                    orientation="vertical"
                    className="mx-1 data-[orientation=vertical]:h-5"
                />
                <ConfigTools />
                <Separator
                    orientation="vertical"
                    className="mx-1 data-[orientation=vertical]:h-5"
                />
                <HistoryTools />
            </div>

            {/* native window controls (Electron, non-mac) merged into the bar */}
            <WindowControls />
        </header>
    )
}
