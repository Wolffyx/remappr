// Pattern check: no GoF pattern (-) — rejected — a React functional view listing
// the dongle's node roster; UI composition over the connection store, no GoF
// abstraction warranted.
//
// Where a host lands after connecting to a ROLE_DONGLE device: the dongle has no
// keymap of its own, so instead of the editor we show its bonded node roster.
// Clicking an online node opens a view of it via the store's openNode, which
// swaps the active service to the relayed node: a mouse or a joystick to edit
// through the relay, a keyboard read-only.
import { JSX, useCallback, useEffect, useState } from 'react'
import {
    Cpu,
    Crown,
    Eraser,
    Plus,
    Power,
    Radio,
    RefreshCw,
    Trash2,
    Unplug,
} from 'lucide-react'
import { toast } from 'sonner'
import useConnectionStore from '@/stores/connectionStore'
import { Button } from '@/ui/button'
import { Label } from '@/ui/label'
import { Switch } from '@/ui/switch'
import type { NodeView } from '@firmware/service'
import { DongleSettingsPanel } from '@/features/device/DongleSettingsPanel'
import { DongleBody } from '@/features/device/DongleBody'
import { NodeIcon } from '@/features/devices/NodeIcon'

export function DongleLanding(): JSX.Element {
    // Field-scoped selectors — avoids re-rendering on unrelated store changes.
    const service = useConnectionStore((s) => s.service)
    const communication = useConnectionStore((s) => s.communication)
    const openNode = useConnectionStore((s) => s.openNode)
    const disconnect = useConnectionStore((s) => s.disconnect)
    const [nodes, setNodes] = useState<NodeView[]>([])
    const [loading, setLoading] = useState(true)
    const [pairing, setPairing] = useState(false)
    // null = state not read yet (query in flight / unsupported firmware).
    const [nkro, setNkro] = useState<boolean | null>(null)

    const nodesApi = service?.nodes

    // All setState happens AFTER the await (never synchronously in the effect
    // body), so the initial load and a manual refresh share one path. `loading`
    // starts true; the refresh button flips it back on before re-fetching.
    const fetchNodes = useCallback(async (): Promise<void> => {
        if (!nodesApi) return
        try {
            setNodes(await nodesApi.list())
        } catch (e) {
            console.warn('Failed to list nodes', e)
            toast.error('Failed to list nodes', {
                description: e instanceof Error ? e.message : String(e),
            })
            setNodes([])
        } finally {
            setLoading(false)
        }
    }, [nodesApi])

    useEffect(() => {
        // One-shot roster fetch on mount; setState lands after the await. Matches
        // the codebase's async-load-in-effect idiom (see AutoLayoutResolver).
        // eslint-disable-next-line react-hooks/set-state-in-effect
        void fetchNodes()
    }, [fetchNodes])

    // NKRO-state query (DONGLE.SET_NKRO, no arg = read-only). An older firmware
    // answers ERR_CMD — leave the toggle hidden (null). Re-run after a settings
    // save, which replaces a live NKRO switch with the saved routing.
    const refreshNkro = useCallback((): void => {
        if (!nodesApi) return
        nodesApi
            .setNkro()
            .then(setNkro)
            .catch(() => setNkro(null))
    }, [nodesApi])

    useEffect(() => {
        refreshNkro()
    }, [refreshNkro])

    // Flip the dongle's USB keystroke routing (NKRO interface vs the BIOS-safe
    // boot 6KRO default). Optimistic UI; revert to the device's answer/old state.
    const handleNkro = useCallback(
        async (enabled: boolean): Promise<void> => {
            if (!nodesApi) return
            setNkro(enabled)
            try {
                setNkro(await nodesApi.setNkro(enabled))
            } catch (e) {
                setNkro(!enabled)
                toast.error('Failed to change NKRO mode', {
                    description: e instanceof Error ? e.message : String(e),
                })
            }
        },
        [nodesApi],
    )

    const refresh = useCallback((): void => {
        setLoading(true)
        void fetchNodes()
    }, [fetchNodes])

    const handleOpen = useCallback(
        async (id: number): Promise<void> => {
            try {
                await openNode(id)
            } catch (e) {
                toast.error('Failed to open node', {
                    description: e instanceof Error ? e.message : String(e),
                })
            }
        },
        [openNode],
    )

    // Remote pairing button (DONGLE.OPEN_PAIR_WINDOW): the node still has to bond
    // on-air, so this just opens the window — the user puts a node in pairing mode
    // and Refreshes once it appears.
    const handlePair = useCallback(async (): Promise<void> => {
        if (!nodesApi) return
        setPairing(true)
        try {
            const open = await nodesApi.openPairWindow(true)
            toast.success(
                open ? 'Pairing window open' : 'Pairing window closed',
                {
                    description: open
                        ? 'Put a node in pairing mode, then Refresh.'
                        : undefined,
                },
            )
        } catch (e) {
            toast.error('Failed to open pairing window', {
                description: e instanceof Error ? e.message : String(e),
            })
        } finally {
            setPairing(false)
        }
    }, [nodesApi])

    // Forget a node (DONGLE.FORGET_NODE) — works on offline/stale bonds too, then
    // re-lists so the freed pipe disappears from the roster.
    const handleForget = useCallback(
        async (id: number, label: string): Promise<void> => {
            if (!nodesApi) return
            try {
                await nodesApi.forgetNode(id)
                toast.success(`Forgot ${label}`)
                void fetchNodes()
            } catch (e) {
                toast.error('Failed to forget node', {
                    description: e instanceof Error ? e.message : String(e),
                })
            }
        },
        [nodesApi, fetchNodes],
    )

    // pattern-check: skip — UI event handler mirroring handleForget; thin facade
    // call + toast/refresh, no new logic or abstraction.
    // Unpair a node (COMMON.UNPAIR_RADIO, owner-sealed): the node forgets its
    // dongle bond and re-arms, then re-pairs onto its same pipe (no leak). Needs
    // the node online for the §19 handshake; re-lists after.
    const handleUnpair = useCallback(
        async (id: number, label: string): Promise<void> => {
            if (!nodesApi) return
            try {
                await nodesApi.unpairRadio(id)
                toast.success(`Unpaired ${label}`, {
                    description: 'Node will re-arm and re-pair.',
                })
                void fetchNodes()
            } catch (e) {
                toast.error('Failed to unpair node', {
                    description: e instanceof Error ? e.message : String(e),
                })
            }
        },
        [nodesApi, fetchNodes],
    )

    // pattern-check: skip — UI event handler; thin facade call + confirm/toast,
    // no new logic or abstraction.
    // Wipe every dongle bond (DONGLE.CLEAR_ALL_BONDS) — recovery for a table full
    // of stale bonds that forget can't reach. Destructive (all nodes must
    // re-pair), so confirm first; re-lists after.
    const handleClearAllBonds = useCallback(async (): Promise<void> => {
        if (!nodesApi) return
        if (
            !window.confirm(
                'Clear ALL dongle bonds? Every paired node is forgotten and must re-pair.',
            )
        )
            return
        try {
            const cleared = await nodesApi.clearAllBonds()
            toast.success(`Cleared ${cleared} bond${cleared === 1 ? '' : 's'}`)
            void fetchNodes()
        } catch (e) {
            toast.error('Failed to clear bonds', {
                description: e instanceof Error ? e.message : String(e),
            })
        }
    }, [nodesApi, fetchNodes])

    const dongleName = service?.deviceInfo.name?.trim() || 'Remappr Dongle'
    const connLabel = communication === 'ble' ? 'BLE' : 'USB'

    return (
        <div className="flex h-full flex-col overflow-hidden">
            {/* Identity + actions. */}
            <div className="flex items-center gap-3 border-b border-border px-5 py-3">
                <Radio className="size-5 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">
                        {dongleName}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                        Dongle · Connected · {connLabel}
                    </div>
                </div>
                {nkro !== null && (
                    <div
                        className="flex items-center gap-2 pr-1"
                        title="Route keystrokes over the NKRO interface (off = BIOS-safe 6KRO). Persists on the dongle."
                    >
                        <Switch
                            id="dongle-nkro"
                            checked={nkro}
                            onCheckedChange={(v) => void handleNkro(v)}
                        />
                        <Label
                            htmlFor="dongle-nkro"
                            className="text-xs text-muted-foreground"
                        >
                            NKRO
                        </Label>
                    </div>
                )}
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void handlePair()}
                    disabled={pairing}
                >
                    <Plus className="mr-1.5 size-3.5" />
                    Pair
                </Button>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={refresh}
                    disabled={loading}
                >
                    <RefreshCw className="mr-1.5 size-3.5" />
                    Refresh
                </Button>
                <Button
                    variant="outline"
                    size="sm"
                    title="Wipe all dongle bonds (recovery for stale bonds)"
                    onClick={() => void handleClearAllBonds()}
                >
                    <Eraser className="mr-1.5 size-3.5" />
                    Clear bonds
                </Button>
                <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => void disconnect()}
                >
                    <Power className="mr-1.5 size-3.5" />
                    Disconnect
                </Button>
            </div>

            {/* Node roster (+ the dongle's own settings when it has a store). */}
            <div className="flex-1 overflow-auto p-5">
                <DongleBody
                    settings={
                        service?.device && (
                            <DongleSettingsPanel
                                device={service.device}
                                onSaved={refreshNkro}
                            />
                        )
                    }
                >
                    <h2 className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Nodes
                    </h2>
                    {loading && nodes.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                            Scanning for nodes…
                        </p>
                    ) : nodes.length === 0 ? (
                        <div className="rounded-[10px] border border-dashed border-border p-6 text-center">
                            <Cpu className="mx-auto mb-2 size-6 text-muted-foreground" />
                            <p className="text-sm font-medium">
                                No paired nodes
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">
                                Open the pairing window, put a node in pairing
                                mode, then Refresh.
                            </p>
                            <Button
                                className="mt-3"
                                size="sm"
                                onClick={() => void handlePair()}
                                disabled={pairing}
                            >
                                <Plus className="mr-1.5 size-3.5" />
                                Open pairing window
                            </Button>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                            {/* pattern-check: skip — presentational JSX restructure
                            of the node row (open + unpair + forget buttons); no
                            new logic or abstraction. */}
                            {nodes.map((n) => (
                                <div
                                    key={n.id}
                                    className="flex items-center gap-1 rounded-[10px] border border-border bg-card pr-1.5 transition-colors hover:border-foreground/30"
                                >
                                    <button
                                        type="button"
                                        disabled={!n.online}
                                        onClick={() => void handleOpen(n.id)}
                                        className="flex min-w-0 flex-1 items-center gap-3 rounded-l-[10px] px-3.5 py-3 text-left transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                        <NodeIcon
                                            kind={n.kind}
                                            className="size-5 shrink-0 text-muted-foreground"
                                        />
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-1.5">
                                                <span className="truncate text-sm font-semibold">
                                                    {n.label}
                                                </span>
                                                {n.isMaster && (
                                                    <span
                                                        title="Topology master (§5 election)"
                                                        className="inline-flex shrink-0 items-center gap-0.5 rounded bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400"
                                                    >
                                                        <Crown className="size-2.5" />
                                                        Master
                                                    </span>
                                                )}
                                            </div>
                                            <div className="text-[11px] text-muted-foreground">
                                                {n.online
                                                    ? 'Online'
                                                    : 'Offline'}
                                                {n.online && n.rssi
                                                    ? ` · ${n.rssi} dBm`
                                                    : ''}
                                                {n.hopCount
                                                    ? ` · ${n.hopCount} hop${
                                                          n.hopCount > 1
                                                              ? 's'
                                                              : ''
                                                      }`
                                                    : ''}
                                            </div>
                                        </div>
                                    </button>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        disabled={!n.online}
                                        className="size-8 shrink-0 text-muted-foreground hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                                        title={
                                            n.online
                                                ? 'Unpair radio (node forgets the dongle and re-pairs)'
                                                : 'Unpair needs the node online'
                                        }
                                        onClick={() =>
                                            void handleUnpair(n.id, n.label)
                                        }
                                    >
                                        <Unplug className="size-4" />
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="size-8 shrink-0 text-muted-foreground hover:text-destructive"
                                        title="Forget node"
                                        onClick={() =>
                                            void handleForget(n.id, n.label)
                                        }
                                    >
                                        <Trash2 className="size-4" />
                                    </Button>
                                </div>
                            ))}
                        </div>
                    )}
                </DongleBody>
            </div>
        </div>
    )
}
