// Pattern check: no GoF pattern (-) — rejected — a settings block over the
// user's licensed devices and the license store; the server enforces limits.
//
// Settings → Account → Builder devices "2 / 3": the devices holding a builder
// license, which one is this, and Deactivate (frees the slot; that device's
// next check drops its license). Shown when the plan allows licensed devices.
import { useCallback, useEffect, useState } from 'react'
import { Cpu, KeyRound } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/ui/button'
import { getCloudClient } from '@/lib/cloud/client'
import { cloudErrorMessage } from '@/lib/cloud/errors'
import useAuthStore from '@/stores/authStore'
import useLicenseStore from '@/stores/licenseStore'

interface LicensedDevice {
    id: string
    hash: string
    platform: string
    label: string
    lastSeen: string
}

interface DevicesView {
    devices: LicensedDevice[]
    max: number
}

async function fetchDevices(): Promise<DevicesView> {
    const client = await getCloudClient()
    if (!client) return { devices: [], max: 0 }
    const [rows, plan] = await Promise.all([
        client
            .from('licensed_devices')
            .select('id, device_pub_hash, platform, label, last_seen_at')
            .is('revoked_at', null)
            .order('activated_at'),
        client.rpc('my_plan'),
    ])
    if (rows.error) throw rows.error
    if (plan.error) throw plan.error
    const max = Number(
        (plan.data as { limits?: { max_devices?: number } } | null)?.limits
            ?.max_devices ?? 0,
    )
    return {
        max,
        devices: rows.data.map((r) => ({
            id: r.id,
            hash: r.device_pub_hash,
            platform: r.platform,
            label: r.label,
            lastSeen: r.last_seen_at,
        })),
    }
}

function shortLabel(d: LicensedDevice): string {
    const browser = /(Firefox|Edg|Chrome|Safari|Electron)\/[\d.]+/.exec(
        d.label,
    )?.[1]
    return [d.platform, browser].filter(Boolean).join(' · ')
}

export function BuilderDevices(): JSX.Element | null {
    const userId = useAuthStore((s) => s.user?.id ?? null)
    const status = useLicenseStore((s) => s.status)
    const deviceHash = useLicenseStore((s) => s.deviceHash)
    const licenseError = useLicenseStore((s) => s.error)
    const leaseOut = useLicenseStore(
        (s) => s.problem === 'expired' || s.problem === 'no_lease',
    )
    const activate = useLicenseStore((s) => s.activate)
    const clear = useLicenseStore((s) => s.clear)
    const [view, setView] = useState<DevicesView | null>(null)
    const [busy, setBusy] = useState(false)

    const reload = useCallback(
        (): Promise<void> => fetchDevices().then(setView),
        [],
    )
    useEffect(() => {
        if (!userId) return
        let live = true
        fetchDevices()
            .then((v) => {
                if (live) setView(v)
            })
            .catch((e: unknown) => toast.error(cloudErrorMessage(e)))
        return () => {
            live = false
        }
    }, [userId, status])

    if (!view || view.max === 0) return null
    const thisActive = view.devices.some((d) => d.hash === deviceHash)

    const run = async (
        task: () => Promise<void>,
        done: string,
    ): Promise<void> => {
        setBusy(true)
        try {
            await task()
            toast.success(done)
            await reload()
        } catch (e) {
            toast.error(e instanceof Error ? e.message : cloudErrorMessage(e))
        } finally {
            setBusy(false)
        }
    }

    const deactivate = (d: LicensedDevice): Promise<void> =>
        run(async () => {
            const client = await getCloudClient()
            if (!client) return
            const { error } = await client.rpc('deactivate_device', {
                p_id: d.id,
            })
            if (error) throw error
            if (d.hash === deviceHash) await clear()
        }, 'Device deactivated; its slot is free')

    return (
        <div className="space-y-2 rounded-xl border bg-background p-4">
            <div className="flex items-center gap-2">
                <KeyRound className="size-4" />
                <span className="flex-1 text-panel-title font-semibold">
                    Builder devices
                </span>
                <span className="text-xs text-muted-foreground">
                    {view.devices.length} / {view.max}
                </span>
            </div>
            <p className="text-xs text-muted-foreground">
                The builder works on the devices holding your license, also
                offline. A lifetime license needs no internet after activation;
                a subscription renews on its own whenever you are online, at
                least once every 30 days.
            </p>
            {leaseOut && (
                <p className="text-xs text-destructive">
                    This device&apos;s subscription license ran out while
                    offline. It renews as soon as you are back online.
                </p>
            )}
            <ul className="space-y-1.5">
                {view.devices.map((d) => (
                    <li
                        key={d.id}
                        className="flex items-center gap-2 rounded-lg border px-3 py-2"
                    >
                        <Cpu className="size-4 shrink-0 text-muted-foreground" />
                        <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-semibold">
                                {shortLabel(d)}
                                {d.hash === deviceHash && ' · this device'}
                            </span>
                            <span className="block text-xs text-muted-foreground">
                                Last seen{' '}
                                {new Date(d.lastSeen).toLocaleDateString()}
                            </span>
                        </span>
                        <Button
                            size="sm"
                            variant="ghost"
                            disabled={busy}
                            onClick={() => void deactivate(d)}
                        >
                            Deactivate
                        </Button>
                    </li>
                ))}
            </ul>
            {!thisActive && (
                <div className="space-y-1">
                    <Button
                        size="sm"
                        variant="outline"
                        disabled={busy || view.devices.length >= view.max}
                        onClick={() =>
                            void run(
                                activate,
                                'This device can use the builder',
                            )
                        }
                    >
                        Activate this device
                    </Button>
                    {licenseError && (
                        <p className="text-xs text-destructive">
                            {licenseError}
                        </p>
                    )}
                </div>
            )}
        </div>
    )
}
