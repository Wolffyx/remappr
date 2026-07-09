// pattern-check: skip — hook consolidation, replaces use-transport-discovery + use-device-connection
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import type { Transport } from '@firmware'
import { UserCancelledError } from '@firmware'
import type { TransportFactory } from '@/transport/types'
import { ensureFirmwareClientsLoaded } from '@/transport/adapter/firmwareClients'
import { getTransports, subscribeToTransportChanges } from '@/lib/transports'
import useConnectionStore from '@/stores/connectionStore'
import type {
    DeviceStatus,
    DeviceWithTransport,
} from '@/features/connection/types'

interface UseConnectionResult {
    transports: TransportFactory[]
    haveTransports: boolean
    hasListableTransports: boolean
    hasSimpleConnectOnly: boolean
    devices: DeviceWithTransport[]
    connectingDeviceId: string | null
    refreshing: boolean
    refresh: () => void
    connect: (d: DeviceWithTransport) => Promise<void>
    simpleConnect: (t: TransportFactory) => Promise<void>
    requestNew: (t: TransportFactory) => Promise<void>
}

function reportConnectError(e: unknown, fallback: string): void {
    if (e instanceof UserCancelledError) return
    if (e instanceof DOMException && e.name === 'NotFoundError') return
    if (e instanceof Error) {
        toast.error(fallback, { description: e.message })
    }
}

export function useConnection(
    onTransportCreated: (
        t: Transport,
        communication: 'serial' | 'ble' | 'hid',
        // Resolves true once the adapter handshake succeeds, false when it
        // fails/times out — lets the caller clear a device's "connecting" state.
    ) => Promise<boolean>,
): UseConnectionResult {
    const transports = useMemo(() => getTransports(), [])

    const { haveTransports, hasListableTransports, hasSimpleConnectOnly } =
        useMemo(() => {
            let hasListable = false
            let allSimple = transports.length > 0
            for (const t of transports) {
                if (t.pick_and_connect) hasListable = true
                if (t.pick_and_connect || !t.connect) allSimple = false
            }
            return {
                haveTransports: transports.length > 0,
                hasListableTransports: hasListable,
                hasSimpleConnectOnly: allSimple,
            }
        }, [transports])

    const [devices, setDevices] = useState<DeviceWithTransport[]>([])
    const [refreshing, setRefreshing] = useState(false)
    const [connectingDeviceId, setConnectingDeviceId] = useState<string | null>(
        null,
    )

    const loadDevices = useCallback(async (): Promise<void> => {
        setRefreshing(true)
        // Discovery filters (hidFilters/hidDiscovery) read the adapter registry,
        // which is now populated lazily — ensure clients are loaded first.
        await ensureFirmwareClientsLoaded()
        const listable = transports.filter((t): boolean => !!t.pick_and_connect)
        const results = await Promise.all(
            listable.map(async (t): Promise<DeviceWithTransport[]> => {
                try {
                    const list = await t.pick_and_connect?.list()
                    return (list ?? []).map(
                        (d): DeviceWithTransport => ({
                            device: d,
                            transport: t,
                            status: 'available' as DeviceStatus,
                        }),
                    )
                } catch (e) {
                    console.error(
                        'Failed to list devices for transport:',
                        t.label,
                        e,
                    )
                    return []
                }
            }),
        )
        setDevices(results.flat())
        setRefreshing(false)
    }, [transports])

    useEffect(() => {
        if (hasListableTransports) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            loadDevices()
        }
    }, [hasListableTransports, loadDevices])

    const connectingDeviceIdRef = useRef(connectingDeviceId)
    useEffect(() => {
        connectingDeviceIdRef.current = connectingDeviceId
    }, [connectingDeviceId])

    useEffect(() => {
        if (!hasListableTransports) return
        return subscribeToTransportChanges((): void => {
            if (connectingDeviceIdRef.current === null) loadDevices()
        })
    }, [hasListableTransports, loadDevices])

    // Electron main fires this on did-finish-load with userGesture=true so
    // navigator.bluetooth.requestDevice doesn't bounce on SecurityError
    // during the initial transport scan. Refresh button uses the same code
    // path; this just bypasses the no-gesture mount-time failure.
    useEffect(() => {
        if (!hasListableTransports) return
        const handler = (): void => {
            if (connectingDeviceIdRef.current === null) void loadDevices()
        }
        window.addEventListener('electron-auto-scan', handler)
        return (): void =>
            window.removeEventListener('electron-auto-scan', handler)
    }, [hasListableTransports, loadDevices])

    const refresh = useCallback((): void => {
        loadDevices()
    }, [loadDevices])

    const setStatus = useCallback((id: string, status: DeviceStatus): void => {
        setDevices((prev): DeviceWithTransport[] =>
            prev.map(
                (d): DeviceWithTransport =>
                    d.device.id === id ? { ...d, status } : d,
            ),
        )
    }, [])

    const connect = useCallback(
        async (target: DeviceWithTransport): Promise<void> => {
            const { device, transport } = target
            setConnectingDeviceId(device.id)
            setStatus(device.id, 'connecting')
            try {
                await ensureFirmwareClientsLoaded()
                const rpc = await transport.pick_and_connect!.connect(device)
                useConnectionStore.getState().setLastConnectedDevice({
                    id: device.id,
                    label: device.label,
                })
                // The transport opened, but the adapter handshake still runs
                // inside onTransportCreated and can fail or hang there. Await it
                // and, if it doesn't reach a connected service, drop the card
                // back to "available" so it never sticks on "Connecting".
                const connected = await onTransportCreated(
                    rpc,
                    transport.communication,
                )
                if (!connected) setStatus(device.id, 'available')
            } catch (e) {
                console.error('Connection error:', e)
                reportConnectError(
                    e,
                    'Failed to connect to the selected device.',
                )
                setStatus(device.id, 'available')
            } finally {
                setConnectingDeviceId(null)
            }
        },
        [onTransportCreated, setStatus],
    )

    const simpleConnect = useCallback(
        async (transport: TransportFactory): Promise<void> => {
            if (!transport.connect) {
                toast.error('Transport not available')
                return
            }
            try {
                await ensureFirmwareClientsLoaded()
                const rpc = await transport.connect()
                useConnectionStore.getState().setLastConnectedDevice(null)
                if (rpc) await onTransportCreated(rpc, transport.communication)
            } catch (e) {
                reportConnectError(
                    e,
                    'Failed to connect to the selected device.',
                )
            }
        },
        [onTransportCreated],
    )

    const requestNew = useCallback(
        async (transport: TransportFactory): Promise<void> => {
            if (!transport.request_new) {
                toast.error('Pairing not supported for this transport')
                return
            }
            try {
                await ensureFirmwareClientsLoaded()
                const rpc = await transport.request_new()
                useConnectionStore.getState().setLastConnectedDevice(null)
                if (rpc) await onTransportCreated(rpc, transport.communication)
            } catch (e) {
                if (
                    e instanceof UserCancelledError ||
                    (e instanceof DOMException && e.name === 'NotFoundError')
                ) {
                    toast.info('Pairing cancelled.')
                    return
                }
                reportConnectError(e, 'Failed to pair device.')
            }
        },
        [onTransportCreated],
    )

    return {
        transports,
        haveTransports,
        hasListableTransports,
        hasSimpleConnectOnly,
        devices,
        connectingDeviceId,
        refreshing,
        refresh,
        connect,
        simpleConnect,
        requestNew,
    }
}
