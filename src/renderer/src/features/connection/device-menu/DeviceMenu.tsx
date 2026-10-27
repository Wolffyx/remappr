// pattern-check: skip — device chip card + dropdown restyled to the redesign spec
import { useCallback, useState } from 'react'
import { RestoreStockModal } from './RestoreStockModal'
import useConnectionStore from '@/stores/connectionStore'
import undoRedoStore from '@/stores/undoRedoStore'
import { useShallow } from 'zustand/react/shallow'
import {
    ArrowLeft,
    CloudUpload,
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
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/ui/dropdown-menu'
import { Settings } from '@/components/modals/Settings'
import { toast } from 'sonner'
import useUserSettingsStore from '@/stores/userSettingsStore'
import useProfileBackupStore, { backupKey } from '@/stores/profileBackupStore'
import { applyRestore } from '@/features/connection/applyRestore'
import { pushBackupToCloud } from '@/features/connection/cloudBackup'
import useAuthStore from '@/stores/authStore'

export const DeviceMenu = (): JSX.Element => {
    // useShallow-scoped subscription — a bare useConnectionStore() re-renders
    // the roster on every unrelated field change (lockState, keyCatalog…).
    const {
        service,
        parentService,
        setService,
        publishService,
        communication,
        deviceName,
        disconnect,
        returnToParent,
        lastConnectedDevice,
    } = useConnectionStore(
        useShallow((s) => ({
            service: s.service,
            parentService: s.parentService,
            setService: s.setService,
            publishService: s.publishService,
            communication: s.communication,
            deviceName: s.deviceName,
            disconnect: s.disconnect,
            returnToParent: s.returnToParent,
            lastConnectedDevice: s.lastConnectedDevice,
        })),
    )
    const reset = undoRedoStore((s) => s.reset)
    const [settingsOpen, setSettingsOpen] = useState(false)

    // The dongle's nodes are in the sidebar's device roster; here only the
    // way back from a node to its dongle.
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
    // Cloud backup needs an account and a hardware serial to match the unit.
    const signedIn = useAuthStore((s) => s.status === 'signed_in')
    const setCloudBackup = useProfileBackupStore((s) => s.setCloud)
    const canCloudBackup = canRestore && signedIn && !!backup?.serialNumber
    const toggleCloudBackup = (on: boolean): void => {
        if (!deviceKey || !backup) return
        setCloudBackup(deviceKey, on)
        if (!on) return
        void pushBackupToCloud({ ...backup, cloud: true }).then((ok) =>
            ok
                ? toast.success('Backup saved to your account')
                : toast.error('Could not save the backup to your account'),
        )
    }
    // Only pick-and-connect devices carry an id we can auto-reconnect to; web
    // simple-connect transports leave lastConnectedDevice null.
    const autoConnectId = lastConnectedDevice?.id ?? null
    const autoConnectOn =
        !!autoConnectId && autoConnectDeviceId === autoConnectId

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
            void publishService(
                currentService,
                currentCommunication ?? undefined,
            )
        }, 0)
    }, [service, communication, reset, setService, publishService])

    // Connected-state tracks the live RPC service, NOT the device name. Some
    // firmwares (e.g. a ZMK build with a blank CONFIG_ZMK_KEYBOARD_NAME) report
    // an empty name even though the session is fully live and editable —
    // gating on the name string wrongly showed "Offline" and disabled the menu.
    const connected = !!service
    const displayName =
        deviceName?.trim() || service?.deviceInfo.name?.trim() || 'Device'
    const connLabel = communication === 'ble' ? 'BLE' : 'USB'
    const statusLabel = viewingNode
        ? `Node · ${readOnly ? 'read-only' : 'via dongle'}`
        : connected
          ? `Connected · ${connLabel}`
          : 'Offline'

    return (
        <>
            {/* Device chip — card with status dot + name + connection, gear opens the menu. */}
            <DropdownMenu>
                <div className="flex items-center gap-2.5 rounded-lg border border-border bg-card px-2.5 py-2">
                    <span
                        aria-hidden
                        className="size-2 shrink-0 rounded-full"
                        style={{
                            background: connected
                                ? 'var(--success)'
                                : 'var(--muted-foreground)',
                            boxShadow: connected
                                ? '0 0 8px var(--success)'
                                : 'none',
                        }}
                    />
                    <div className="min-w-0 flex-1">
                        <div className="truncate text-control font-semibold">
                            {connected ? displayName : 'No device connected'}
                        </div>
                        <div className="text-meta text-muted-foreground">
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
                    {canCloudBackup && (
                        <DropdownMenuCheckboxItem
                            checked={!!backup?.cloud}
                            onCheckedChange={toggleCloudBackup}
                            onSelect={(e): void => e.preventDefault()}
                        >
                            <CloudUpload className="mr-2 h-4 w-4" />
                            Back up to my account
                        </DropdownMenuCheckboxItem>
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
