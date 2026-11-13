// pattern-check: skip — the tab chrome the merged Cluster dialog hands its panels
//
// The cluster panels (status, role, link) each render inside a "frame": the
// standalone Modal by default, or this tab frame inside the one Cluster dialog.
// The frame takes the Modal's props, so a panel's markup is the same either way.
import type { ComponentType } from 'react'

import type { ModernModalProps } from '@/ui/modal'

export type PanelFrame = ComponentType<ModernModalProps>

/** Body plus the panel's own footer (Cancel/Save), inline under it; the
 *  dialog's title and close live on the surrounding Cluster dialog. */
export function TabFrame({
    subtitle,
    footer,
    children,
}: ModernModalProps): JSX.Element {
    return (
        <div className="flex flex-col gap-3">
            {subtitle && (
                <p className="px-2 text-caption text-muted-foreground">
                    {subtitle}
                </p>
            )}
            {children}
            {footer && (
                <div className="flex justify-end gap-2 border-t pt-3">
                    {footer}
                </div>
            )}
        </div>
    )
}
