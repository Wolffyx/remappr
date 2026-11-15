// pattern-check: skip — branch extraction from TransportSection
import { Button } from '@/ui/button'
import type { TransportFactory } from '@/transport/types'

interface SimpleConnectGridProps {
    transports: TransportFactory[]
    onSimpleConnect: (t: TransportFactory) => void
}

export function SimpleConnectGrid({
    transports,
    onSimpleConnect,
}: SimpleConnectGridProps): JSX.Element {
    return (
        <div className="grid gap-3 sm:grid-cols-2">
            {transports.map((t) => (
                <Button
                    key={t.label}
                    variant="outline"
                    className="h-auto flex-col gap-2 py-6"
                    onClick={() => onSimpleConnect(t)}
                >
                    {t.isWireless ? (
                        <span className="text-info">Bluetooth</span>
                    ) : (
                        <span>USB</span>
                    )}
                    <span className="text-sm text-muted-foreground">
                        Connect via {t.label}
                    </span>
                </Button>
            ))}
        </div>
    )
}
