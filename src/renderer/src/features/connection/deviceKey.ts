// Pattern check: no GoF pattern (-) — rejected — one fallback rule as a function.
import type { AvailableDevice } from '@/transport/types'

/**
 * The key per-device state is stored under (snapshots, auto-connect, profile
 * backups, recents and pins): the identity the device reports when the
 * transport can read one, else the transport's own id. An OS path such as
 * /dev/hidrawN changes on a replug, a device-reported serial does not.
 */
export function deviceKey(device: Pick<AvailableDevice, 'id' | 'key'>): string {
    return device.key ?? device.id
}
