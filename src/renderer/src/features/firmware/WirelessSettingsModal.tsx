// pattern-check: skip — Keychron wireless settings modal; reads/writes through service.wireless facade
import { NumberInput } from '@/ui/number-input'
import { useEffect, useState } from 'react'
import { Wifi } from 'lucide-react'
import { toast } from 'sonner'

import type { WirelessStatus } from '@firmware'
import useConnectionStore from '@/stores/connectionStore'
import { saveWithToast } from '@/lib/saveWithToast'
import { Modal } from '@/ui/modal'
import { Button } from '@/ui/button'
import { Label } from '@/ui/label'
import { Switch } from '@/ui/switch'

interface Props {
    opened: boolean
    onClose: () => void
}

export function WirelessSettingsModal({ opened, onClose }: Props): JSX.Element {
    const wireless = useConnectionStore((s) => s.service?.wireless)

    const [lpmEnabled, setLpmEnabled] = useState(false)
    const [lpmTimeout, setLpmTimeout] = useState(0)
    const [nkro, setNkro] = useState<boolean | null>(null)
    const [moduleLabel, setModuleLabel] = useState<string | null>(null)
    const [status, setStatus] = useState<WirelessStatus>({ transport: 'usb' })
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        if (!opened || !wireless) return
        let cancelled = false
        ;(async () => {
            setLoading(true)
            try {
                const lpm = await wireless.getLpm()
                if (!cancelled) {
                    setLpmEnabled(lpm.enabled)
                    setLpmTimeout(lpm.timeoutMs)
                }
                if (wireless.getNkro) {
                    const n = await wireless.getNkro()
                    if (!cancelled) setNkro(n)
                }
                if (wireless.getModuleInfo) {
                    try {
                        const info = await wireless.getModuleInfo()
                        if (!cancelled) setModuleLabel(info.label)
                    } catch {
                        /* optional */
                    }
                }
                const s = await wireless.getStatus()
                if (!cancelled) setStatus(s)
            } catch (e) {
                toast.error(
                    `Failed to read wireless settings: ${
                        e instanceof Error ? e.message : String(e)
                    }`,
                )
            } finally {
                if (!cancelled) setLoading(false)
            }
        })()
        const off = wireless.onStatusChanged((s) => {
            if (!cancelled) setStatus(s)
        })
        return (): void => {
            cancelled = true
            off()
        }
    }, [opened, wireless])

    if (!wireless) return <></>

    const saveLpm = (): Promise<void | undefined> =>
        saveWithToast(
            () =>
                wireless.setLpm({
                    enabled: lpmEnabled,
                    timeoutMs: lpmTimeout,
                }),
            'Low-power mode updated',
            'Failed to update low-power mode',
        )

    const toggleNkro = async (next: boolean): Promise<void> => {
        if (!wireless.setNkro) return
        const r = await saveWithToast(
            () => wireless.setNkro!(next),
            `NKRO ${next ? 'enabled' : 'disabled'}`,
            'Failed to update NKRO',
        )
        if (r !== undefined) setNkro(next)
    }

    const factoryReset = (): Promise<void | undefined> | void => {
        if (!wireless.factoryReset) return
        if (
            !window.confirm(
                'Reset all settings to factory defaults? This cannot be undone.',
            )
        ) {
            return
        }
        return saveWithToast(
            () => wireless.factoryReset!(),
            'Factory reset issued',
            'Factory reset failed',
        )
    }

    return (
        <Modal
            size="md"
            kind="live"
            opened={opened}
            onClose={onClose}
            title="Wireless settings"
            subtitle="Power, NKRO and connection"
            headerIcon={<Wifi />}
        >
            <div className="flex flex-col gap-4 p-2 text-sm">
                <section className="flex flex-col gap-2">
                    <h3 className="font-semibold">Status</h3>
                    <div className="text-xs text-muted-foreground">
                        Transport: {status.transport}
                        {status.btSlot ? ` · BT slot ${status.btSlot}` : ''}
                        {status.battery
                            ? ` · Battery ${status.battery.level}%${
                                  status.battery.charging ? ' (charging)' : ''
                              }`
                            : ''}
                    </div>
                    {moduleLabel && (
                        <div className="text-xs text-muted-foreground">
                            Wireless module: {moduleLabel}
                        </div>
                    )}
                </section>

                <section className="flex flex-col gap-2">
                    <h3 className="font-semibold">Low-power mode</h3>
                    <div className="flex items-center gap-2">
                        <Switch
                            id="lpm-enabled"
                            checked={lpmEnabled}
                            onCheckedChange={setLpmEnabled}
                            disabled={loading}
                        />
                        <Label htmlFor="lpm-enabled">Low-power mode</Label>
                    </div>
                    <div className="flex items-center gap-2">
                        <Label htmlFor="lpm-timeout" className="w-28 text-xs">
                            Timeout (ms)
                        </Label>
                        <NumberInput
                            id="lpm-timeout"
                            value={lpmTimeout}
                            onChange={(e) =>
                                setLpmTimeout(parseInt(e.target.value, 10) || 0)
                            }
                            disabled={loading}
                        />
                    </div>
                    <Button
                        onClick={saveLpm}
                        disabled={loading}
                        className="w-32"
                    >
                        Save
                    </Button>
                </section>

                {nkro !== null && (
                    <section className="flex flex-col gap-2">
                        <h3 className="font-semibold">N-key rollover</h3>
                        <div className="flex items-center gap-2">
                            <Switch
                                id="nkro"
                                checked={nkro}
                                onCheckedChange={toggleNkro}
                                disabled={loading}
                            />
                            <Label htmlFor="nkro">
                                Send every key at once (NKRO)
                            </Label>
                        </div>
                    </section>
                )}

                {wireless.factoryReset && (
                    <section className="flex flex-col gap-2">
                        <h3 className="font-semibold text-destructive">
                            Danger zone
                        </h3>
                        <Button
                            variant="destructive"
                            onClick={factoryReset}
                            disabled={loading}
                            className="w-48"
                        >
                            Factory reset
                        </Button>
                    </section>
                )}
            </div>
        </Modal>
    )
}
