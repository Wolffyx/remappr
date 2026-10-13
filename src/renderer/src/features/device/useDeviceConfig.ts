// Pattern check: no GoF pattern (-) — rejected — a React hook holding the
// load / save state of one device's config over the `service.device` facade.
import { useCallback, useEffect, useState } from 'react'
import type { ConfigDevice } from '@firmware/config'
import type { DeviceConfigApi, DeviceConfigSnapshot } from '@firmware'

import { saveWithToast } from '@/lib/saveWithToast'

export interface DeviceConfigState {
    /** The config read from the device; null until the first read lands. */
    snapshot: DeviceConfigSnapshot | null
    loading: boolean
    /** Why the last read failed (the page shows it instead of the form). */
    error: string | null
    saving: boolean
    reload: () => void
    /** Push `config`; resolves true once the device took it (and was re-read). */
    save: (config: ConfigDevice) => Promise<boolean>
}

const message = (e: unknown): string =>
    e instanceof Error ? e.message : String(e)

export function useDeviceConfig(
    device: DeviceConfigApi | undefined,
): DeviceConfigState {
    const [snapshot, setSnapshot] = useState<DeviceConfigSnapshot | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [saving, setSaving] = useState(false)

    // setState lands after the await, so the mount load and a reload share it.
    const load = useCallback(async (): Promise<void> => {
        if (!device) return
        try {
            setSnapshot(await device.read())
            setError(null)
        } catch (e) {
            console.warn('Failed to read device settings', e)
            setError(message(e))
        } finally {
            setLoading(false)
        }
    }, [device])

    useEffect(() => {
        // One-shot read on mount (async-load-in-effect idiom, see DongleLanding).
        // eslint-disable-next-line react-hooks/set-state-in-effect
        void load()
    }, [load])

    const reload = useCallback((): void => {
        setLoading(true)
        void load()
    }, [load])

    const save = useCallback(
        async (config: ConfigDevice): Promise<boolean> => {
            if (!device) return false
            setSaving(true)
            const version = await saveWithToast(
                () => device.write(config),
                'Settings saved',
                'Failed to save settings',
            )
            if (version !== undefined) await load()
            setSaving(false)
            return version !== undefined
        },
        [device, load],
    )

    return { snapshot, loading, error, saving, reload, save }
}
