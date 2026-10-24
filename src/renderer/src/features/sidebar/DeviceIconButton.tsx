// Pattern check: no GoF pattern (-) — rejected — one presentational icon button with a status dot and tooltip, shared by the strip and the rail.
import type { JSX } from 'react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/ui/tooltip'
import { cn } from '@/lib/cn'
import type { RosterEntry } from './roster'

/** A device as an icon: status dot, tooltip with its name and link, one
 *  click to open it. */
export function DeviceIconButton({
    entry,
    size = 'strip',
    side = 'bottom',
}: {
    entry: RosterEntry
    size?: 'strip' | 'rail'
    side?: 'bottom' | 'right'
}): JSX.Element {
    const Icon = entry.icon
    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <button
                    type="button"
                    aria-label={entry.name}
                    aria-current={entry.active ? 'true' : undefined}
                    onClick={(): void => void entry.open()}
                    className={cn(
                        'relative grid shrink-0 place-items-center rounded-md border border-transparent text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                        size === 'strip' ? 'h-7 w-[30px]' : 'size-9',
                        entry.active &&
                            'border-primary/40 bg-[color-mix(in_oklab,var(--primary)_14%,var(--sidebar))] text-primary hover:bg-[color-mix(in_oklab,var(--primary)_14%,var(--sidebar))] hover:text-primary',
                    )}
                >
                    <Icon
                        className={
                            size === 'strip' ? 'size-[15px]' : 'size-[18px]'
                        }
                    />
                    <span
                        aria-hidden
                        className={cn(
                            'absolute right-0.5 bottom-0.5 size-1.5 rounded-full ring-[1.5px] ring-sidebar',
                            entry.online ? 'bg-success' : 'bg-muted-foreground',
                        )}
                    />
                </button>
            </TooltipTrigger>
            <TooltipContent side={side}>
                <p className="font-semibold">{entry.name}</p>
                <p className="opacity-80">{entry.detail}</p>
            </TooltipContent>
        </Tooltip>
    )
}
