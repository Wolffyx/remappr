// pattern-check: skip — cluster-diagnostics view; reads/subscribes through the
// service.cluster facade (§N4b-3), mirrors WirelessSettingsModal. No abstraction.
//
// Plain status first (design review f6, D3): each node's role and link in words,
// then one table of the raw values with "Copy for support".
import { Badge } from '@/ui/badge'
import { useEffect, useState } from 'react'
import {
    Activity,
    Copy,
    Cpu,
    Crown,
    Network,
    RefreshCw,
    User,
} from 'lucide-react'
import { toast } from 'sonner'

import type { ClusterDiag, RoleEvent } from '@firmware'
import useConnectionStore from '@/stores/connectionStore'
import { Modal } from '@/ui/modal'
import type { PanelFrame } from './clusterFrame'
import { Button } from '@/ui/button'
import { LearnMore } from '@/ui/learn-more'
import { diagReport, hex2 } from './clusterReport'
import { cn } from '@/lib/cn'

interface Props {
    opened: boolean
    onClose: () => void
    /** The dialog chrome; the merged Cluster dialog passes a tab frame. */
    frame?: PanelFrame
}

/** One captured role transition, keyed by a session-monotonic sequence. */
interface RoleLogEntry {
    seq: number
    event: RoleEvent
}

const errText = (e: unknown): string =>
    e instanceof Error ? e.message : String(e)

/** main node = amber crown chip; follower = muted user chip. */
function RoleBadge({ coordinator }: { coordinator: boolean }): JSX.Element {
    return coordinator ? (
        <Badge size="sm" tone="warning">
            <Crown />
            Main node
        </Badge>
    ) : (
        <Badge size="sm" tone="muted">
            <User />
            Follower
        </Badge>
    )
}

/** A peer's link in plain words: connected and responding, connected but
 *  silent, or not connected. */
function linkState(p: ClusterDiag['peers'][number]): {
    label: string
    ok: boolean
} {
    if (p.ready && p.seen)
        return { label: 'Connected and responding', ok: true }
    if (p.ready) return { label: 'Connected, not responding', ok: false }
    return { label: 'Not connected', ok: false }
}

/** One compact table of the raw values behind the plain status above it. */
function RawValues({ diag }: { diag: ClusterDiag }): JSX.Element {
    const copy = async (): Promise<void> => {
        try {
            await navigator.clipboard.writeText(diagReport(diag))
            toast.success('Copied the raw values')
        } catch (e) {
            toast.error(`Couldn’t copy: ${errText(e)}`)
        }
    }
    const cell = 'px-2 py-1 font-mono'
    return (
        <section className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
                <h3 className="font-semibold">Raw values</h3>
                <Button variant="outline" size="sm" onClick={() => void copy()}>
                    <Copy className="size-3.5" />
                    Copy for support
                </Button>
            </div>
            <table className="w-full border-collapse text-caption">
                <thead>
                    <tr className="border-b border-border text-left text-muted-foreground">
                        {['Node', 'Role', 'Up', 'Seen', 'Round', 'Flags'].map(
                            (h) => (
                                <th key={h} className="px-2 py-1 font-semibold">
                                    {h}
                                </th>
                            ),
                        )}
                    </tr>
                </thead>
                <tbody>
                    <tr className="border-b border-border/60">
                        <td className={cell}>this</td>
                        <td className={cell}>
                            {diag.coordinator ? 'main' : 'follower'}
                        </td>
                        <td className={cell}>–</td>
                        <td className={cell}>–</td>
                        <td className={cell}>{diag.localTerm}</td>
                        <td className={cell}>{hex2(diag.localFlags)}</td>
                    </tr>
                    {diag.peers.map((p, i) => (
                        <tr key={i} className="border-b border-border/60">
                            <td className={cell}>port {i}</td>
                            <td className={cell}>
                                {p.coordinator ? 'main' : 'follower'}
                            </td>
                            <td className={cell}>{p.ready ? 'yes' : 'no'}</td>
                            <td className={cell}>{p.seen ? 'yes' : 'no'}</td>
                            <td className={cell}>{p.term}</td>
                            <td className={cell}>{hex2(p.hbFlags)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </section>
    )
}

export function ClusterDiagnosticsModal({
    opened,
    onClose,
    frame: Frame = Modal,
}: Props): JSX.Element {
    const cluster = useConnectionStore((s) => s.service?.cluster)

    const [diag, setDiag] = useState<ClusterDiag | null>(null)
    const [events, setEvents] = useState<RoleLogEntry[]>([])
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        if (!opened || !cluster) return
        let cancelled = false
        let seq = 0
        ;(async () => {
            setLoading(true)
            try {
                const d = await cluster.getDiag()
                if (!cancelled) setDiag(d)
            } catch (e) {
                if (!cancelled) {
                    toast.error(
                        `Failed to read cluster diagnostics: ${errText(e)}`,
                    )
                }
            } finally {
                if (!cancelled) setLoading(false)
            }
        })()
        const off = cluster.onRoleChanged((event) => {
            if (cancelled) return
            setEvents((prev) => [{ seq: seq++, event }, ...prev].slice(0, 20))
            // The event carries THIS node's new role — reflect it live in the
            // snapshot header without a re-read.
            setDiag((prev) =>
                prev
                    ? {
                          ...prev,
                          coordinator: event.coordinator,
                          localFlags: event.flags,
                          localTerm: event.term,
                      }
                    : prev,
            )
        })
        return (): void => {
            cancelled = true
            off()
        }
    }, [opened, cluster])

    const refresh = async (): Promise<void> => {
        if (!cluster) return
        setLoading(true)
        try {
            setDiag(await cluster.getDiag())
        } catch (e) {
            toast.error(`Failed to read cluster diagnostics: ${errText(e)}`)
        } finally {
            setLoading(false)
        }
    }

    if (!cluster) return <></>

    return (
        <Frame
            size="lg"
            kind="readonly"
            opened={opened}
            onClose={onClose}
            title="Cluster diagnostics"
            subtitle="Each node’s role and connection, live"
            headerIcon={<Network />}
        >
            <div className="flex flex-col gap-4 p-2 text-sm">
                <section className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                        <h3 className="font-semibold">This node</h3>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="size-8"
                            onClick={() => void refresh()}
                            disabled={loading}
                            title="Refresh"
                        >
                            <RefreshCw
                                className={cn(
                                    'size-4',
                                    loading && 'animate-spin',
                                )}
                            />
                        </Button>
                    </div>
                    {diag ? (
                        <div className="flex flex-wrap items-center gap-2">
                            <RoleBadge coordinator={diag.coordinator} />
                        </div>
                    ) : (
                        <p className="text-xs text-muted-foreground">
                            {loading ? 'Reading…' : 'No data.'}
                        </p>
                    )}
                </section>

                <section className="flex flex-col gap-2">
                    <h3 className="font-semibold">Connected nodes</h3>
                    {!diag || diag.peers.length === 0 ? (
                        <p className="text-xs text-muted-foreground">
                            No other nodes are connected.
                        </p>
                    ) : (
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                            {diag.peers.map((p, i) => {
                                const link = linkState(p)
                                return (
                                    <div
                                        key={i}
                                        className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5"
                                    >
                                        <Cpu className="size-5 shrink-0 text-muted-foreground" />
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-1.5">
                                                <span className="text-sm font-semibold">
                                                    Port {i}
                                                </span>
                                                <span className="text-xs text-muted-foreground">
                                                    {p.coordinator
                                                        ? 'Main node'
                                                        : 'Follower'}
                                                </span>
                                            </div>
                                            <div className="mt-1">
                                                <Badge
                                                    size="sm"
                                                    tone={
                                                        link.ok
                                                            ? 'success'
                                                            : 'muted'
                                                    }
                                                >
                                                    {link.label}
                                                </Badge>
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </section>

                <section className="flex flex-col gap-2">
                    <h3 className="flex items-center gap-1.5 font-semibold">
                        <Activity className="size-4" />
                        Role changes
                    </h3>
                    <p className="text-xs text-muted-foreground">
                        Shows when a node switches role while running. If this
                        firmware sets each node’s role at start-up, this stays
                        empty.{' '}
                        <LearnMore path="guide/app/advanced#cluster-diagnostics" />
                    </p>
                    {events.length === 0 ? (
                        <p className="text-xs text-muted-foreground">
                            Listening… no role changes yet.
                        </p>
                    ) : (
                        <ul className="flex flex-col gap-1">
                            {events.map(({ seq, event }) => (
                                <li
                                    key={seq}
                                    className="flex items-center gap-2 rounded-md border border-border bg-card px-2.5 py-1.5 text-xs"
                                >
                                    <RoleBadge
                                        coordinator={event.coordinator}
                                    />
                                    <span className="text-muted-foreground">
                                        {event.coordinator
                                            ? 'Became the main node'
                                            : 'Became a follower'}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    )}
                </section>

                {diag && <RawValues diag={diag} />}
            </div>
        </Frame>
    )
}
