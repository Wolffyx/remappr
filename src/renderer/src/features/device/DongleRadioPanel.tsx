// Pattern check: no GoF pattern (-) — rejected — leaf view: reads the dongle's
// link stats and starts a channel change through the nodes facade.
//
// The dongle's radio channels: the hop map with each channel's failure rate,
// and a button that moves every node off the failing channels. The dongle never
// changes channels on its own (each node remembers them to reconnect fast), so
// this is the only way they change. The change rolls out a channel at a time;
// the panel polls until it is done.
import { JSX, useCallback, useEffect, useState } from 'react'
import { ArrowRightLeft, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import type { NodesApi, RadioLinkStats } from '@firmware/service'

import { Badge } from '@/ui/badge'
import { Button } from '@/ui/button'

import { SettingsSection } from './SettingRows'

/** How often to re-read the stats while a change rolls out. */
const ROLLOUT_POLL_MS = 1000

const isBad = (lastFail: number | null, limit: number): boolean =>
    lastFail !== null && lastFail > limit

export function DongleRadioPanel({ nodes }: { nodes: NodesApi }): JSX.Element {
    const [stats, setStats] = useState<RadioLinkStats | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [busy, setBusy] = useState(false)

    const load = useCallback(async (): Promise<void> => {
        try {
            setStats(await nodes.getLinkStats())
            setError(null)
        } catch (e) {
            setError(e instanceof Error ? e.message : String(e))
        }
    }, [nodes])

    useEffect(() => {
        // One-shot read on mount; setState lands after the await.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        void load()
    }, [load])

    const rolling = stats?.changeInProgress ?? false

    useEffect(() => {
        if (!rolling) return
        const timer = setInterval(() => void load(), ROLLOUT_POLL_MS)
        return (): void => clearInterval(timer)
    }, [rolling, load])

    const badCount =
        stats?.channels.filter((c) =>
            isBad(c.lastFailPercent, stats.failPercent),
        ).length ?? 0

    const change = useCallback(async (): Promise<void> => {
        if (
            !window.confirm(
                'Move every connected device off the failing channels? Devices that are off right now find the dongle again when they are turned on.',
            )
        )
            return
        setBusy(true)
        try {
            const r = await nodes.changeChannels()
            if (r.planned === 0) {
                toast.info('No channel needs changing')
            } else {
                toast.success(
                    `Changing ${r.planned} channel${r.planned === 1 ? '' : 's'}`,
                    { description: 'Devices follow one channel at a time.' },
                )
            }
            await load()
        } catch (e) {
            toast.error('Failed to change channels', {
                description: e instanceof Error ? e.message : String(e),
            })
        } finally {
            setBusy(false)
        }
    }, [nodes, load])

    return (
        <SettingsSection
            title="Radio channels"
            description="The dongle keeps its channels until you change them here; every device remembers them to reconnect quickly. A failing channel is one that lost more packets than the limit in its last test window."
            actions={
                <div className="flex shrink-0 gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => void load()}
                    >
                        <RefreshCw className="mr-1.5 size-3.5" />
                        Refresh
                    </Button>
                    <Button
                        size="sm"
                        onClick={() => void change()}
                        disabled={busy || rolling || badCount === 0}
                        title={
                            badCount === 0
                                ? 'No failing channel to replace'
                                : 'Replace the failing channels on the dongle and every device'
                        }
                    >
                        <ArrowRightLeft className="mr-1.5 size-3.5" />
                        Change channels
                    </Button>
                </div>
            }
        >
            {error && <p className="text-xs text-destructive">{error}</p>}
            {stats && (
                <>
                    <div className="text-xs text-muted-foreground">
                        {stats.channels.length} channels in use ·{' '}
                        {stats.poolCount} spare · failing over{' '}
                        {stats.failPercent}% · generation {stats.mapGeneration}
                        {rolling && ' · change in progress…'}
                    </div>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                        {stats.channels.map((c) => {
                            const bad = isBad(
                                c.lastFailPercent,
                                stats.failPercent,
                            )
                            return (
                                <div
                                    key={c.channel}
                                    className="flex items-center justify-between rounded-md border border-border px-2.5 py-1.5"
                                >
                                    <div>
                                        <div className="text-sm font-semibold tabular-nums">
                                            {2400 + c.channel} MHz
                                        </div>
                                        <div className="text-xs text-muted-foreground tabular-nums">
                                            {c.lastFailPercent === null
                                                ? 'not tested yet'
                                                : `${c.lastFailPercent}% lost`}
                                        </div>
                                    </div>
                                    {bad && (
                                        <Badge variant="destructive">
                                            Failing
                                        </Badge>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                </>
            )}
        </SettingsSection>
    )
}
