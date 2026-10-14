// pattern-check: skip — slim shell that dispatches to one of three branch components
import { RefreshCw } from 'lucide-react'
import { Button } from '@/ui/button'
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/ui/card'
import type { GenericInputDevice } from '@firmware/generic'
import type { TransportFactory } from '@/transport/types'
import type { DeviceWithTransport } from '@/features/connection/types'
import { SimpleConnectGrid } from './transport-section/SimpleConnectGrid'
import { ListedDevices } from './transport-section/ListedDevices'
import { EmptyState } from './transport-section/EmptyState'
import { InputDeviceGrid } from './transport-section/InputDeviceGrid'

interface TransportSectionProps {
    transports: TransportFactory[]
    devices: DeviceWithTransport[]
    hasListableTransports: boolean
    hasSimpleConnectOnly: boolean
    refreshing: boolean
    connectingDeviceId: string | null
    onRefresh: () => void
    onConnect: (d: DeviceWithTransport) => void
    onSimpleConnect: (t: TransportFactory) => void
    onRequestNew: (t: TransportFactory) => void
    /** Controllers and mice with no vendor protocol (view + live test). */
    inputDevices: readonly GenericInputDevice[]
    /** The browser can see controllers once a button is pressed. */
    gamepadHint: boolean
    onOpenInput: (d: GenericInputDevice) => void
}

export function TransportSection({
    transports,
    devices,
    hasListableTransports,
    hasSimpleConnectOnly,
    refreshing,
    connectingDeviceId,
    onRefresh,
    onConnect,
    onSimpleConnect,
    onRequestNew,
    inputDevices,
    gamepadHint,
    onOpenInput,
}: TransportSectionProps): JSX.Element {
    const pairableTransports = transports.filter((t) => !!t.request_new)
    const found = devices.length + inputDevices.length
    const inputGrid = (
        <InputDeviceGrid
            devices={inputDevices}
            gamepadHint={gamepadHint}
            onOpen={onOpenInput}
        />
    )

    return (
        <Card className="mb-8">
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle>Available Devices</CardTitle>
                        <CardDescription>
                            {hasSimpleConnectOnly
                                ? 'Select a connection type to connect your device'
                                : 'Select a device to connect'}
                        </CardDescription>
                    </div>
                    {hasListableTransports && (
                        <Button
                            variant="outline"
                            size="icon"
                            onClick={onRefresh}
                            disabled={refreshing}
                        >
                            <RefreshCw
                                className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`}
                            />
                        </Button>
                    )}
                </div>
            </CardHeader>
            <CardContent>
                {hasSimpleConnectOnly ? (
                    <div className="space-y-4">
                        <SimpleConnectGrid
                            transports={transports}
                            onSimpleConnect={onSimpleConnect}
                        />
                        {inputGrid}
                    </div>
                ) : hasListableTransports && found > 0 ? (
                    <div className="space-y-4">
                        <ListedDevices
                            devices={devices}
                            pairableTransports={pairableTransports}
                            connectingDeviceId={connectingDeviceId}
                            refreshing={refreshing}
                            onConnect={onConnect}
                            onRefresh={onRefresh}
                            onRequestNew={onRequestNew}
                        />
                        {inputGrid}
                        <p className="text-center text-xs text-muted-foreground">
                            {found} device{found === 1 ? '' : 's'} found · click
                            one to open its editor
                        </p>
                    </div>
                ) : hasListableTransports ? (
                    <>
                        <EmptyState
                            pairableTransports={pairableTransports}
                            refreshing={refreshing}
                            onRefresh={onRefresh}
                            onRequestNew={onRequestNew}
                        />
                        {inputGrid}
                    </>
                ) : null}
            </CardContent>
        </Card>
    )
}
