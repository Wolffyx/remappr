// pattern-check: skip — device chip card + dropdown restyled to the redesign spec
import { useCallback, useState } from 'react'
import { RestoreStockModal } from './RestoreStockModal'
import useConnectionStore from '@/stores/connectionStore'
import undoRedoStore from '@/stores/undoRedoStore'
import { useShallow } from 'zustand/react/shallow'
import {
    ArrowLeft,
    Check,
    Cpu,
    Power,
    RotateCcw,
    Settings as SettingsIcon,
    Zap,
} from 'lucide-react'
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/ui/dropdown-menu'
import { Settings } from '@/components/modals/Settings'
import { toast } from 'sonner'
import useUserSettingsStore from '@/stores/userSettingsStore'
import useProfileBackupStore, { backupKey } from '@/stores/profileBackupStore'
import { applyRestore } from '@/features/connection/applyRestore'
import type { NodeView } from '@firmware/service'

export const DeviceMenu = (): JSX.Element => {
    // useShallow-scoped subscription — a bare useConnectionStore() re-renders
    // the roster on every unrelated field change (lockState, keyCatalog…).
    const {
        service,
        parentService,
        activeNodeId,
        setService,
        communication,
        deviceName,
        disconnect,
        openNode,
        returnToParent,
        lastConnectedDevice,
    } = useConnectionStore(
        useShallow((s) => ({
            service: s.service,
            parentService: s.parentService,
            activeNodeId: s.activeNodeId,
            setService: s.setService,
            communication: s.communication,
            deviceName: s.deviceName,
            disconnect: s.disconnect,
            openNode: s.openNode,
            returnToParent: s.returnToParent,
            lastConnectedDevice: s.lastConnectedDevice,
        })),
    )
    const reset = undoRedoStore((s) => s.reset)
    const [settingsOpen, setSettingsOpen] = useState(false)
    const [nodes, setNodes] = useState<NodeView[]>([])
    const [nodesLoading, setNodesLoading] = useState(false)

    // The node roster lives on the dongle: when viewing a node that's the stashed
    // parent, otherwise the live service. Empty for a direct (non-dongle) device,
    // so the Mesh-nodes section stays hidden on ordinary keyboards.
    const dongle = parentService ?? service
    const nodesApi = dongle?.nodes
    const viewingNode = !!parentService
    const readOnly = !!service?.capabilities.readOnly

    // Profile restore (manual entry point) + auto-connect toggle state.
    const autoConnectDeviceId = useUserSettingsStore(
        (s) => s.autoConnectDeviceId,
    )
    const setAutoConnectDeviceId = useUserSettingsStore(
        (s) => s.setAutoConnectDeviceId,
    )
    const backups = useProfileBackupStore((s) => s.backups)
    const deviceKey = service
        ? backupKey(service, lastConnectedDevice?.id)
        : null
    const backup = deviceKey ? backups[deviceKey] : undefined
    const canRestore =
        !readOnly && !!service?.capabilities.profileRestore && !!backup
    // Only pick-and-connect devices carry an id we can auto-reconnect to; web
    // simple-connect transports leave lastConnectedDevice null.
    const autoConnectId = lastConnectedDevice?.id ?? null
    const autoConnectOn =
        !!autoConnectId && autoConnectDeviceId === autoConnectId

    const loadNodes = useCallback(async (): Promise<void> => {
        if (!nodesApi) {
            setNodes([])
            return
        }
        setNodesLoading(true)
        try {
            setNodes(await nodesApi.list())
        } catch (e) {
            console.warn('Failed to list nodes', e)
            setNodes([])
        } finally {
            setNodesLoading(false)
        }
    }, [nodesApi])

    const handleOpenNode = useCallback(
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

    const resetSettings = useCallback(async (): Promise<void> => {
        if (!service) return
        try {
            await service.resetSettings()
        } catch (e) {
            console.error('Failed to settings reset', e)
            toast.error('Failed to settings reset')
            return
        }

        reset()

        const currentService = service
        const currentCommunication = communication
        setService(null)

        setTimeout(() => {
            setService(currentService, currentCommunication ?? undefined)
        }, 0)
    }, [service, communication, reset, setService])

    // Connected-state tracks the live RPC service, NOT the device name. Some
    // firmwares (e.g. a ZMK build with a blank CONFIG_ZMK_KEYBOARD_NAME) report
    // an empty name even though the session is fully live and editable —
    // gating on the name string wrongly showed "Offline" and disabled the menu.
    const connected = !!service
    const displayName =
        deviceName?.trim() || service?.deviceInfo.name?.trim() || 'Keyboard'
    const connLabel = communication === 'ble' ? 'BLE' : 'USB'
    const statusLabel = viewingNode
        ? 'Node · read-only'
        : connected
          ? `Connected · ${connLabel}`
          : 'Offline'

    return (
        <>
            {/* Device chip — card with status dot + name + connection, gear opens the menu. */}
            <DropdownMenu
                onOpenChange={(open): void => {
                    if (open) void loadNodes()
                }}
            >
                <div className="flex items-center gap-2.5 rounded-[10px] border border-border bg-card px-2.5 py-2">
                    <span
                        aria-hidden
                        className="size-2 shrink-0 rounded-full"
                        style={{
                            background: connected
                                ? 'oklch(0.72 0.16 152)'
                                : 'var(--muted-foreground)',
                            boxShadow: connected
                                ? '0 0 8px oklch(0.72 0.16 152)'
                                : 'none',
                        }}
                    />
                    <div className="min-w-0 flex-1">
                        <div className="truncate text-[12.5px] font-semibold">
                            {connected ? displayName : 'No Device Connected'}
                        </div>
                        <div className="text-[10.5px] text-muted-foreground">
                            {statusLabel}
                        </div>
                    </div>
                    <DropdownMenuTrigger asChild>
                        <button
                            type="button"
                            disabled={!connected}
                            aria-label="Device menu"
                            className="grid size-[26px] shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-40 data-[state=open]:bg-accent"
                        >
                            <SettingsIcon className="size-[15px]" />
                        </button>
                    </DropdownMenuTrigger>
                </div>

                <DropdownMenuContent
                    side="top"
                    align="end"
                    className="w-[220px]"
                >
                    {viewingNode && (
                        <>
                            <DropdownMenuItem onClick={returnToParent}>
                                <ArrowLeft className="mr-2 h-4 w-4" />
                                <span className="flex-1 truncate">
                                    Back to{' '}
                                    {parentService?.deviceInfo.name?.trim() ||
                                        'dongle'}
                                </span>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                        </>
                    )}

                    {(nodes.length > 0 || nodesLoading) && (
                        <>
                            <DropdownMenuLabel className="text-[11px] font-normal text-muted-foreground">
                                Mesh nodes
                            </DropdownMenuLabel>
                            {nodesLoading && nodes.length === 0 ? (
                                <DropdownMenuItem disabled>
                                    Scanning…
                                </DropdownMenuItem>
                            ) : (
                                nodes.map((n) => (
                                    <DropdownMenuItem
                                        key={n.id}
                                        disabled={
                                            !n.online || n.id === activeNodeId
                                        }
                                        onClick={(): void => {
                                            void handleOpenNode(n.id)
                                        }}
                                    >
                                        <Cpu className="mr-2 h-4 w-4 shrink-0" />
                                        <span className="flex-1 truncate">
                                            {n.label}
                                        </span>
                                        {n.id === activeNodeId ? (
                                            <Check className="h-4 w-4 shrink-0" />
                                        ) : (
                                            !n.online && (
                                                <span className="text-[10px] text-muted-foreground">
                                                    offline
                                                </span>
                                            )
                                        )}
                                    </DropdownMenuItem>
                                ))
                            )}
                            <DropdownMenuSeparator />
                        </>
                    )}

                    {autoConnectId && (
                        <DropdownMenuCheckboxItem
                            checked={autoConnectOn}
                            onCheckedChange={(checked): void =>
                                setAutoConnectDeviceId(
                                    checked ? autoConnectId : null,
                                )
                            }
                            onSelect={(e): void => e.preventDefault()}
                        >
                            <Zap className="mr-2 h-4 w-4" />
                            Auto-connect on launch
                        </DropdownMenuCheckboxItem>
                    )}
                    <DropdownMenuItem
                        onClick={disconnect}
                        className="text-destructive focus:text-destructive"
                    >
                        <Power className="mr-2 h-4 w-4" />
                        Disconnect
                    </DropdownMenuItem>
                    {canRestore && (
                        <DropdownMenuItem
                            onClick={(): void => {
                                if (service && backup && deviceKey)
                                    void applyRestore(
                                        service,
                                        backup,
                                        deviceKey,
                                    )
                            }}
                        >
                            <RotateCcw className="mr-2 h-4 w-4" />
                            Restore backup
                        </DropdownMenuItem>
                    )}
                    {!readOnly && (
                        <RestoreStockModal
                            onOk={(): void => {
                                resetSettings()
                            }}
                        />
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                        onClick={(): void => setSettingsOpen(true)}
                    >
                        <SettingsIcon className="mr-2 h-4 w-4" />
                        App settings
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
            <Settings
                opened={settingsOpen}
                onClose={(): void => setSettingsOpen(false)}
            />
        </>
    )
}
