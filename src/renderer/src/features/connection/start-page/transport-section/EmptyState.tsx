// pattern-check: skip — branch extraction from TransportSection
import { Monitor, RefreshCw } from 'lucide-react'
import { Button } from '@/ui/button'
import type { TransportFactory } from '@/transport/types'
import { PairNewButton } from './PairNewButton'

interface EmptyStateProps {
    pairableTransports: TransportFactory[]
    refreshing: boolean
    onRefresh: () => void
    onRequestNew: (t: TransportFactory) => void
}

export function EmptyState({
    pairableTransports,
    refreshing,
    onRefresh,
    onRequestNew,
}: EmptyStateProps): JSX.Element {
    const hasPairable = pairableTransports.length > 0

    return (
        <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                <Monitor className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="mb-2 font-semibold">
                {hasPairable ? 'No Paired Devices' : 'No Devices Found'}
            </h3>
            <p className="mb-4 max-w-sm text-sm text-muted-foreground">
                {hasPairable
                    ? 'Browsers only show keyboards you have paired with this site. Click below to pick yours from the system chooser — it stays remembered for next time.'
                    : 'Make sure your device is connected.'}
            </p>
            <div className="flex flex-wrap justify-center gap-2">
                {hasPairable ? (
                    <PairNewButton
                        transports={pairableTransports}
                        onRequestNew={onRequestNew}
                    />
                ) : (
                    <Button
                        variant="outline"
                        onClick={onRefresh}
                        disabled={refreshing}
                    >
                        <RefreshCw
                            className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`}
                        />
                        {refreshing ? 'Scanning…' : 'Scan for Devices'}
                    </Button>
                )}
            </div>
        </div>
    )
}
