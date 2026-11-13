// pattern-check: skip — presentational status pill (config-lookup → dot + label),
// single concern, no abstraction warranted.
import { cn } from '@/lib/cn'
import type { DeviceStatus } from '@/features/connection/types'

const STATUS_CONFIG: Record<
    DeviceStatus,
    {
        bgColor: string
        textColor: string
        dotColor: string
        pulse: boolean
        label: string
    }
> = {
    available: {
        bgColor: 'bg-success/15',
        textColor: 'text-success',
        dotColor: 'bg-success',
        pulse: false,
        label: 'Ready',
    },
    connecting: {
        bgColor: 'bg-warning/15',
        textColor: 'text-warning',
        dotColor: 'bg-warning',
        pulse: true,
        label: 'Connecting',
    },
    connected: {
        bgColor: 'bg-primary/15',
        textColor: 'text-primary',
        dotColor: 'bg-primary',
        pulse: false,
        label: 'Connected',
    },
}

export function StatusBadge({
    status,
    prominent = false,
}: {
    status: DeviceStatus
    prominent?: boolean
}): JSX.Element {
    const config = STATUS_CONFIG[status]
    return (
        <div
            className={cn(
                'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5',
                config.bgColor,
            )}
        >
            <span
                className={cn(
                    'h-1.5 w-1.5 rounded-full',
                    config.dotColor,
                    config.pulse && 'animate-pulse',
                )}
            />
            <span
                className={cn(
                    'text-xs font-medium',
                    config.textColor,
                    prominent && 'font-mono uppercase tracking-wider',
                )}
            >
                {config.label}
            </span>
        </div>
    )
}
