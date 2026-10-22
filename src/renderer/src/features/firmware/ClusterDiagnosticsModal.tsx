// pattern-check: skip — cluster-diagnostics view; reads/subscribes through the
// service.cluster facade (§N4b-3), mirrors WirelessSettingsModal. No abstraction.
import { Badge } from '@/ui/badge'
import { useEffect, useState } from 'react'
import { Activity, Cpu, Crown, Network, RefreshCw, User } from 'lucide-react'
import { toast } from 'sonner'

import type { ClusterDiag, RoleEvent } from '@firmware'
import useConnectionStore from '@/stores/connectionStore'
import { Modal } from '@/ui/modal'
import { Button } from '@/ui/button'
import { cn } from '@/lib/cn'

interface Props {
    opened: boolean
    onClose: () => void
}

/** One captured role transition, keyed by a session-monotonic sequence. */
interface RoleLogEntry {
    seq: number
    event: RoleEvent
}

const errText = (e: unknown): string =>
    e instanceof Error ? e.message : String(e)

const hex2 = (n: number): string => `0x${n.toString(16).padStart(2, '0')}`

/** coordinator = amber crown chip; follower = muted user chip. */
function RoleBadge({ coordinator }: { coordinator: boolean }): JSX.Element {
    return coordinator ? (
        <Badge size="sm" tone="warning">
            <Crown />
            Coordinator
        </Badge>
    ) : (
        <Badge size="sm" tone="muted">
            <User />
            Follower
        </Badge>
    )
}

/** ready/seen state pill: green when the flag is set, muted otherwise. */
function StateChip({ label, ok }: { label: string; ok: boolean }): JSX.Element {
    return (
        <Badge size="sm" tone={ok ? 'success' : 'muted'}>
            {label}
        </Badge>
    )
}

function MetaChip({ children }: { children: React.ReactNode }): JSX.Element {
    return (
        <span className="inline-flex items-center rounded bg-muted px-1.5 py-0.5 text-meta font-medium text-muted-foreground">
            {children}
        </span>
    )
}

export function ClusterDiagnosticsModal({
    opened,
    onClose,
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
        <Modal
            size="lg"
            kind="readonly"
            opened={opened}
            onClose={onClose}
            title="Cluster Diagnostics"
            subtitle="Node-bus role & live transitions"
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
                            {(diag.localTerm > 0 || diag.localFlags > 0) && (
                                <span className="text-xs text-muted-foreground">
                                    term {diag.localTerm} · flags{' '}
                                    {hex2(diag.localFlags)}
                                </span>
                            )}
                        </div>
                    ) : (
                        <p className="text-xs text-muted-foreground">
                            {loading ? 'Reading…' : 'No data.'}
                        </p>
                    )}
                </section>

                <section className="flex flex-col gap-2">
                    <h3 className="font-semibold">Node-bus peers</h3>
                    {!diag || diag.peers.length === 0 ? (
                        <p className="text-xs text-muted-foreground">
                            No node-bus peers reported.
                        </p>
                    ) : (
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                            {diag.peers.map((p, i) => (
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
                                                    ? 'coordinator'
                                                    : 'follower'}
                                            </span>
                                        </div>
                                        <div className="mt-1 flex flex-wrap items-center gap-1">
                                            <StateChip
                                                label={
                                                    p.ready ? 'ready' : 'down'
                                                }
                                                ok={p.ready}
                                            />
                                            <StateChip
                                                label={
                                                    p.seen ? 'seen' : 'unseen'
                                                }
                                                ok={p.seen}
                                            />
                                            {p.term > 0 && (
                                                <MetaChip>
                                                    term {p.term}
                                                </MetaChip>
                                            )}
                                            {p.hbFlags > 0 && (
                                                <MetaChip>
                                                    hb {hex2(p.hbFlags)}
                                                </MetaChip>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </section>

                <section className="flex flex-col gap-2">
                    <h3 className="flex items-center gap-1.5 font-semibold">
                        <Activity className="size-4" />
                        Live role transitions
                    </h3>
                    <p className="text-xs text-muted-foreground">
                        Role events fire only on a runtime role change. The
                        config-blob role is boot-only, so on current firmware
                        this stays quiet until the cluster election (N5) lands.
                    </p>
                    {events.length === 0 ? (
                        <p className="text-xs text-muted-foreground">
                            Listening… no transitions yet.
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
                                    {event.term > 0 && (
                                        <span className="text-muted-foreground">
                                            term {event.term}
                                        </span>
                                    )}
                                </li>
                            ))}
                        </ul>
                    )}
                </section>
            </div>
        </Modal>
    )
}
