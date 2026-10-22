// pattern-check: skip — layout shell delegating to toolbar clusters, no abstraction
//
// The header shell: brand on the left, the project links centred, three tool
// clusters on the right. A `1fr auto 1fr` grid keeps the links at the true
// centre while both sides fit, and shifts them rather than overlapping when
// the tool clusters outgrow their half.
//
// Each cluster (layout/toolbar/) owns its own store subscriptions, so a heatmap
// toggle no longer re-renders the save pill and an undo push no longer re-renders
// the dialog buttons. What stays here is genuinely header-level: window chrome,
// the brand button and the cluster order.
//
// The keymap editor's clusters are the default; another editor (the device
// editor) passes its own `tools` and brand `icon`.
import type { ReactNode } from 'react'
import { Blocks, Keyboard, type LucideIcon } from 'lucide-react'

import useBuilderStore from '@/stores/builderStore'
import useConnectionStore from '@/stores/connectionStore'
import { SidebarTrigger, useSidebar } from '@/ui/sidebar'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/ui/tooltip'
import { KeymapToolClusters } from '@/layout/toolbar/KeymapToolClusters'
import { CommunityLinks } from '@/layout/toolbar/CommunityLinks'
import { WindowControls } from '@/layout/WindowControls'
import { TrafficLightInset } from '@/layout/TrafficLightInset'

const noDrag = { WebkitAppRegion: 'no-drag' } as React.CSSProperties

interface HeaderProps {
    /** Brand tile icon (the device's form on the device editor). */
    icon?: LucideIcon
    /** The right-hand tool clusters; the keymap editor's by default. */
    tools?: ReactNode
}

export function Header({
    icon: BrandIcon = Keyboard,
    tools = <KeymapToolClusters />,
}: HeaderProps = {}): JSX.Element {
    const { state: sidebarState } = useSidebar()
    const disconnect = useConnectionStore((s) => s.disconnect)
    // Only when the editor was reached via the builder's "Editor" handoff do we
    // offer a way back. A directly-connected device never shows this.
    const cameFromBuilder = useBuilderStore((s) => s.cameFromBuilder)
    const returnToBuilder = useBuilderStore((s) => s.returnToBuilder)

    return (
        <header
            className="grid h-(--header-height) shrink-0 select-none grid-cols-[1fr_auto_1fr] items-center gap-1 border-b bg-card pl-2 transition-[width,height] ease-linear"
            style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
        >
            {/* ===== left: sidebar toggle + brand ===== */}
            <div className="flex h-full items-center gap-1">
                {/* With the sidebar open, the window's top-left corner (and
                    the macOS traffic lights over it) belongs to the Drawer —
                    only when it's collapsed does this header reach the window
                    edge and need to clear them itself (no-op on
                    Windows/Linux). */}
                {sidebarState === 'collapsed' && <TrafficLightInset />}
                <div className="flex items-center gap-1" style={noDrag}>
                    <SidebarTrigger />
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <button
                                type="button"
                                onClick={disconnect}
                                className="flex items-center gap-2 rounded-lg border border-transparent px-2 py-1 text-foreground transition-colors hover:bg-accent"
                            >
                                <span className="grid size-7 place-items-center rounded-md bg-[linear-gradient(150deg,var(--primary),color-mix(in_oklab,var(--primary)_65%,#000))] text-primary-foreground">
                                    <BrandIcon className="size-4" />
                                </span>
                                <span className="text-brand font-bold">
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
                                    className="flex items-center gap-1.5 rounded-lg border border-border px-2 py-1 text-panel-title font-semibold text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
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
            </div>

            {/* ===== centre: project links ===== */}
            <CommunityLinks />

            {/* ===== right: tool clusters + window controls ===== */}
            <div className="flex h-full items-center justify-self-end">
                <div
                    className="flex items-center gap-1 pr-1"
                    data-coach="tools"
                    style={noDrag}
                >
                    {tools}
                </div>

                {/* native window controls (Electron, non-mac) merged into the bar */}
                <WindowControls />
            </div>
        </header>
    )
}
