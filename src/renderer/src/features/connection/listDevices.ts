// Pattern check: no GoF pattern (-) — rejected — the listing loop lifted out of useConnection unchanged, so the start page and the sidebar's Switch device share it; one async function.
import type { TransportFactory } from '@/transport/types'
import { ensureFirmwareClientsLoaded } from '@/transport/adapter/firmwareClients'
import type { DeviceWithTransport } from './types'

/** Every device the listable transports (the ones that can list and pick)
 *  offer now. A transport that fails to list is logged and left out. */
export async function listDevices(
    transports: TransportFactory[],
): Promise<DeviceWithTransport[]> {
    // Discovery filters (hidFilters/hidDiscovery) read the adapter registry,
    // which is populated lazily — ensure clients are loaded first.
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
                        status: 'available',
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
    return results.flat()
}
