// pattern-check: skip — Keychron Advanced-Mode settings modal; reads/writes through service.advanced + service.wireless facades
import { NumberInput } from '@/ui/number-input'
import { useEffect, useState } from 'react'
import { Settings2 } from 'lucide-react'
import { toast } from 'sonner'

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

const DEBOUNCE_MIN = 0
const DEBOUNCE_MAX = 80

export function AdvancedSettingsModal({ opened, onClose }: Props): JSX.Element {
    const advanced = useConnectionStore((s) => s.service?.advanced)
    const wireless = useConnectionStore((s) => s.service?.wireless)

    const [debounceMode, setDebounceMode] = useState(0)
    const [debounceMs, setDebounceMs] = useState<number | null>(null)
    const [reportRate, setReportRate] = useState<number | null>(null)
    const [snapClick, setSnapClick] = useState<boolean | null>(null)
    const [nkro, setNkro] = useState<boolean | null>(null)
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        if (!opened || !advanced) return
        let cancelled = false
        ;(async () => {
            setLoading(true)
            try {
                if (advanced.getDebounce) {
                    const d = await advanced.getDebounce()
                    if (!cancelled) {
                        setDebounceMode(d.mode)
                        setDebounceMs(d.responseMs)
                    }
                }
                if (advanced.getReportRate) {
                    const r = await advanced.getReportRate()
                    if (!cancelled) setReportRate(r)
                }
                if (advanced.getSnapClick) {
                    const s = await advanced.getSnapClick()
                    if (!cancelled) setSnapClick(s)
                }
                if (wireless?.getNkro) {
                    const n = await wireless.getNkro()
                    if (!cancelled) setNkro(n)
                }
            } catch (e) {
                toast.error(
                    `Failed to read advanced settings: ${
                        e instanceof Error ? e.message : String(e)
                    }`,
                )
            } finally {
                if (!cancelled) setLoading(false)
            }
        })()
        return (): void => {
            cancelled = true
        }
    }, [opened, advanced, wireless])

    if (!advanced) return <></>

    const saveDebounce = (): Promise<void | undefined> | void => {
        if (!advanced.setDebounce || debounceMs === null) return
        return saveWithToast(
            () =>
                advanced.setDebounce!({
                    mode: debounceMode,
                    responseMs: debounceMs,
                }),
            'Debounce updated',
            'Failed to update debounce',
        )
    }

    const saveReportRate = (): Promise<void | undefined> | void => {
        if (!advanced.setReportRate || reportRate === null) return
        return saveWithToast(
            () => advanced.setReportRate!(reportRate),
            'Report rate updated',
            'Failed to update report rate',
        )
    }

    const toggleSnap = async (next: boolean): Promise<void> => {
        if (!advanced.setSnapClick) return
        const r = await saveWithToast(
            () => advanced.setSnapClick!(next),
            `Snap-click ${next ? 'enabled' : 'disabled'}`,
            'Failed to update snap-click',
        )
        if (r !== undefined) setSnapClick(next)
    }

    const toggleNkro = async (next: boolean): Promise<void> => {
        if (!wireless?.setNkro) return
        const r = await saveWithToast(
            () => wireless.setNkro!(next),
            `NKRO ${next ? 'enabled' : 'disabled'}`,
            'Failed to update NKRO',
        )
        if (r !== undefined) setNkro(next)
    }

    return (
        <Modal
            size="md"
            kind="live"
            opened={opened}
            onClose={onClose}
            title="Advanced Mode"
            subtitle="Debounce, report rate & key behaviour"
            headerIcon={<Settings2 />}
        >
            <div className="flex flex-col gap-4 p-2 text-sm">
                {advanced.getDebounce && debounceMs !== null && (
                    <section className="flex flex-col gap-2">
                        <h3 className="font-semibold">Debounce</h3>
                        <label className="flex flex-col gap-1.5">
                            <span className="flex items-center justify-between text-panel-title font-medium">
                                Response time
                                <span className="font-mono text-xs text-muted-foreground">
                                    {debounceMs} ms
                                </span>
                            </span>
                            <input
                                type="range"
                                min={DEBOUNCE_MIN}
                                max={DEBOUNCE_MAX}
                                value={debounceMs}
                                onChange={(e) =>
                                    setDebounceMs(Number(e.currentTarget.value))
                                }
                                disabled={loading}
                                className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-secondary accent-primary"
                            />
                        </label>
                        <div className="flex items-center gap-2">
                            <Label
                                htmlFor="debounce-mode"
                                className="w-28 text-xs"
                            >
                                Mode (raw)
                            </Label>
                            <NumberInput
                                id="debounce-mode"
                                min={0}
                                max={255}
                                value={debounceMode}
                                onChange={(e) =>
                                    setDebounceMode(
                                        parseInt(e.target.value, 10) || 0,
                                    )
                                }
                                disabled={loading}
                            />
                            <span className="text-meta text-muted-foreground">
                                enum TBD on hardware
                            </span>
                        </div>
                        <Button
                            onClick={saveDebounce}
                            disabled={loading}
                            className="w-40"
                        >
                            Save debounce
                        </Button>
                    </section>
                )}

                {advanced.getReportRate && reportRate !== null && (
                    <section className="flex flex-col gap-2">
                        <h3 className="font-semibold">Report rate</h3>
                        <div className="flex items-center gap-2">
                            <Label
                                htmlFor="report-rate"
                                className="w-28 text-xs"
                            >
                                Value (raw)
                            </Label>
                            <NumberInput
                                id="report-rate"
                                min={0}
                                max={255}
                                value={reportRate}
                                onChange={(e) =>
                                    setReportRate(
                                        parseInt(e.target.value, 10) || 0,
                                    )
                                }
                                disabled={loading}
                            />
                        </div>
                        <Button
                            onClick={saveReportRate}
                            disabled={loading}
                            className="w-40"
                        >
                            Save report rate
                        </Button>
                    </section>
                )}

                {snapClick !== null && (
                    <section className="flex flex-col gap-2">
                        <h3 className="font-semibold">Snap-click</h3>
                        <div className="flex items-center gap-2">
                            <Switch
                                id="snap-click"
                                checked={snapClick}
                                onCheckedChange={toggleSnap}
                                disabled={loading}
                            />
                            <Label htmlFor="snap-click">
                                Enable snap-click (rapid trigger)
                            </Label>
                        </div>
                    </section>
                )}

                {nkro !== null && (
                    <section className="flex flex-col gap-2">
                        <h3 className="font-semibold">N-Key Rollover</h3>
                        <div className="flex items-center gap-2">
                            <Switch
                                id="adv-nkro"
                                checked={nkro}
                                onCheckedChange={toggleNkro}
                                disabled={loading}
                            />
                            <Label htmlFor="adv-nkro">Enable NKRO</Label>
                        </div>
                    </section>
                )}

                {advanced.quickStart && (
                    <section className="flex flex-col gap-1">
                        <h3 className="font-semibold">Quick Start</h3>
                        <p className="text-xs text-muted-foreground">
                            Supported by this keyboard. Auto-sleep &amp;
                            auto-backlight-off timeouts live in the Wireless
                            panel.
                        </p>
                    </section>
                )}
            </div>
        </Modal>
    )
}
