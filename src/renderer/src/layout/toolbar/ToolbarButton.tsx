// pattern-check: skip — composition of existing UI primitives, no abstraction
//
// The toolbar's repeated shapes, written once.
//
// Nearly every control in the header was the same four-to-six levels of nesting
// — Tooltip → TooltipTrigger asChild → (FeatureGate) → (span) → Button → icon —
// spelled out per button, roughly 17 lines each. What actually differed was an
// icon, a tooltip string, a click handler and sometimes a capability.
//
// Three primitives cover every one of them:
//   ToolbarButton  an icon button that does something
//   ToolbarLink    an icon button that opens an external URL
//   ToolbarSlot    a tooltip around a control that renders its own trigger
//                  (Download / Settings / SupportModal)
import type { ComponentType, ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'

import { Button } from '@/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/ui/tooltip'
import { FeatureGate } from '@/features/firmware/FeatureGate'
import type { Feature } from '@/features/firmware/useFeatureAvailable'

/** How a toggled-on tool reads. The toolbar uses both; they are not
 *  interchangeable, so each caller says which one it means.
 *  - `'tint'`: stays a ghost button, icon and background take the accent.
 *  - `'solid'`: switches to the filled `secondary` variant. */
type ActiveStyle = 'tint' | 'solid'

const TINT_ACTIVE =
    'data-[active=true]:bg-primary/20 data-[active=true]:text-primary'

interface ToolbarButtonProps {
    icon: LucideIcon
    /** Tooltip body. */
    tooltip: ReactNode
    /** Button aria-label — the longer, descriptive form. */
    label: string
    onClick?: () => void
    disabled?: boolean
    /** Whether the tool this button controls is currently on. */
    active?: boolean
    activeStyle?: ActiveStyle
    /** Capability the firmware must expose for this button to render at all. */
    feature?: Feature
}

export function ToolbarButton({
    icon: Icon,
    tooltip,
    label,
    onClick,
    disabled,
    active = false,
    activeStyle = 'tint',
    feature,
}: ToolbarButtonProps): JSX.Element {
    const solid = activeStyle === 'solid' && active
    const button = (
        <Tooltip>
            <TooltipTrigger asChild>
                {/* The span is what lets a DISABLED button still show its
                    tooltip — Radix listens on the trigger, and a disabled
                    button fires no pointer events. Applied uniformly: the
                    hand-written toolbar had it on undo/redo/discard but not on
                    the equally-disableable dynamic/macros/RGB buttons. */}
                <span>
                    <Button
                        variant={solid ? 'secondary' : 'ghost'}
                        size="icon"
                        disabled={disabled}
                        onClick={onClick}
                        {...(activeStyle === 'tint'
                            ? { 'data-active': active, className: TINT_ACTIVE }
                            : {})}
                    >
                        <Icon aria-label={label} />
                    </Button>
                </span>
            </TooltipTrigger>
            <TooltipContent>
                <p>{tooltip}</p>
            </TooltipContent>
        </Tooltip>
    )

    return feature ? (
        <FeatureGate feature={feature}>{button}</FeatureGate>
    ) : (
        button
    )
}

interface ToolbarLinkProps {
    /** Lucide icon or a local brand glyph — anything taking `className`. */
    icon: ComponentType<{ className?: string }>
    href: string
    tooltip: ReactNode
    label: string
}

export function ToolbarLink({
    icon: Icon,
    href,
    tooltip,
    label,
}: ToolbarLinkProps): JSX.Element {
    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" asChild>
                    <a
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={label}
                    >
                        <Icon className="h-4 w-4" />
                    </a>
                </Button>
            </TooltipTrigger>
            <TooltipContent>
                <p>{tooltip}</p>
            </TooltipContent>
        </Tooltip>
    )
}

/** Tooltip around a control that already renders its own trigger button. The
 *  wrapper element is required: TooltipTrigger `asChild` needs exactly one DOM
 *  child to attach to, and these components render a Button plus a dialog. */
export function ToolbarSlot({
    tooltip,
    children,
}: {
    tooltip: ReactNode
    children: ReactNode
}): JSX.Element {
    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <div>{children}</div>
            </TooltipTrigger>
            <TooltipContent>
                <p>{tooltip}</p>
            </TooltipContent>
        </Tooltip>
    )
}
