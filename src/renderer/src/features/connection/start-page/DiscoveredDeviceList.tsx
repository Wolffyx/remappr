// pattern-check: skip — capability dispatch via transport methods, no abstraction
import { DeviceCard } from './DeviceCard'
import type { DeviceWithTransport } from '@/features/connection/types'
import useDevicePreviewStore from '@/stores/devicePreviewStore'
import { deviceKey } from '@/features/connection/deviceKey'

interface DiscoveredDeviceListProps {
    devices: DeviceWithTransport[]
    connectingDeviceId: string | null
    refreshing?: boolean
    onConnect: (d: DeviceWithTransport) => void
    onRefresh?: () => void
}

export function DiscoveredDeviceList({
    devices,
    connectingDeviceId,
    refreshing = false,
    onConnect,
    onRefresh,
}: DiscoveredDeviceListProps): JSX.Element {
    const snapshots = useDevicePreviewStore((s) => s.snapshots)
    return (
        <div className="space-y-3">
            {devices.map((d) => {
                const canRename = !!d.transport.renameDevice
                const canForget = !!d.transport.forgetDevice
                const preview =
                    snapshots[deviceKey(d.device)] ??
                    Object.values(snapshots).find(
                        (s) => s.name === d.device.label,
                    )
                return (
                    <DeviceCard
                        key={d.device.id}
                        name={d.device.label}
                        status={d.status}
                        isWireless={d.transport.isWireless}
                        preview={preview}
                        onConnect={() => onConnect(d)}
                        disabled={
                            refreshing ||
                            (connectingDeviceId !== null &&
                                connectingDeviceId !== d.device.id)
                        }
                        canRename={canRename}
                        onRename={
                            canRename
                                ? (next) => {
                                      d.transport.renameDevice!(d.device, next)
                                      onRefresh?.()
                                  }
                                : undefined
                        }
                        onForget={
                            canForget
                                ? async () => {
                                      await d.transport.forgetDevice!(d.device)
                                      onRefresh?.()
                                  }
                                : undefined
                        }
                    />
                )
            })}
        </div>
    )
}
