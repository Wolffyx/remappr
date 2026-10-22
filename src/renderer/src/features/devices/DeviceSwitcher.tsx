// Pattern check: no GoF pattern (-) — rejected — presentational sidebar group plus a small listing hook over the shared listDevices / switchToDevice; one caller.
import { useEffect, useState, type JSX } from 'react'
import {
    ArrowRight,
    Bluetooth,
    Keyboard,
    Loader2,
    Usb,
    type LucideIcon,
} from 'lucide-react'
import {
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel,
} from '@/ui/sidebar'
import { getTransports, subscribeToTransportChanges } from '@/lib/transports'
import { FORM_LABEL } from '@/lib/devices/labels'
import { switchToDevice } from '@/features/connection/connectTransport'
import { listDevices } from '@/features/connection/listDevices'
import type { DeviceWithTransport } from '@/features/connection/types'
import useConnectionStore from '@/stores/connectionStore'
import useDevicePreviewStore, {
    type DevicePreviewSnapshot,
} from '@/stores/devicePreviewStore'
import { FORM_ICON } from './formIcons'

export const SWITCH_GROUP_LABEL =
    'text-caption font-bold tracking-[0.08em] text-muted-foreground uppercase'

/** One device to switch to: icon, name, a short kind line. */
export function SwitchRow({
    icon: Icon,
    name,
    detail,
    busy,
    disabled,
    onClick,
}: {
    icon: LucideIcon
    name: string
    detail: string
    busy?: boolean
    disabled?: boolean
    onClick: () => void
}): JSX.Element {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            className="flex w-full items-center gap-2 rounded-md px-2 py-[7px] text-left text-sidebar-foreground transition-colors hover:bg-accent disabled:pointer-events-none disabled:opacity-60"
        >
            <span className="grid size-[26px] shrink-0 place-items-center rounded-md bg-foreground/[.08] text-muted-foreground">
                <Icon className="size-3.5" />
            </span>
            <span className="min-w-0 flex-1">
                <span className="block truncate text-control font-semibold">
                    {name}
                </span>
                <span className="block text-meta text-muted-foreground">
                    {detail}
                </span>
            </span>
            {busy ? (
                <Loader2 className="size-[13px] animate-spin text-muted-foreground" />
            ) : (
                <ArrowRight className="size-[13px] text-muted-foreground" />
            )}
        </button>
    )
}

/** The devices this computer can connect to now, refreshed when one is
 *  plugged in or removed. Lists nothing while `enabled` is false. */
function useListedDevices(enabled: boolean): DeviceWithTransport[] {
    const [devices, setDevices] = useState<DeviceWithTransport[]>([])
    useEffect(() => {
        if (!enabled) return
        let live = true
        const transports = getTransports()
        const load = (): void => {
            void listDevices(transports).then((found) => {
                if (live) setDevices(found)
            })
        }
        load()
        const off = subscribeToTransportChanges(load)
        return (): void => {
            live = false
            off()
        }
    }, [enabled])
    return enabled ? devices : []
}

/** What the last session on a device saw of it, else how it is attached. */
function describe(
    d: DeviceWithTransport,
    snapshot: DevicePreviewSnapshot | undefined,
): { icon: LucideIcon; detail: string } {
    const form = snapshot?.device?.model.form
    if (form) return { icon: FORM_ICON[form], detail: FORM_LABEL[form] }
    if (snapshot) return { icon: Keyboard, detail: 'Keyboard' }
    if (d.transport.isWireless) return { icon: Bluetooth, detail: 'Bluetooth' }
    return { icon: Usb, detail: 'USB' }
}

/**
 * The other devices to switch to, for a session on a real device (the demo
 * has its own list). Switching asks first about unsaved edits and opens the
 * new device before the current one closes.
 */
export function DeviceSwitcher(): JSX.Element | null {
    const demo = useConnectionStore((s) => !!s.service?.capabilities.demo)
    const currentId = useConnectionStore(
        (s) => s.lastConnectedDevice?.id ?? null,
    )
    const snapshots = useDevicePreviewStore((s) => s.snapshots)
    const listed = useListedDevices(!demo)
    const [switching, setSwitching] = useState<string | null>(null)

    const others = listed.filter((d) => d.device.id !== currentId)
    if (others.length === 0) return null

    const pick = (d: DeviceWithTransport): void => {
        setSwitching(d.device.id)
        void switchToDevice(d).finally(() => setSwitching(null))
    }

    return (
        <SidebarGroup>
            <SidebarGroupLabel className={SWITCH_GROUP_LABEL}>
                Switch device
            </SidebarGroupLabel>
            <SidebarGroupContent className="flex flex-col gap-[3px]">
                {others.map((d) => {
                    const { icon, detail } = describe(d, snapshots[d.device.id])
                    return (
                        <SwitchRow
                            key={d.device.id}
                            icon={icon}
                            name={d.device.label}
                            detail={detail}
                            busy={switching === d.device.id}
                            disabled={switching !== null}
                            onClick={() => pick(d)}
                        />
                    )
                })}
            </SidebarGroupContent>
        </SidebarGroup>
    )
}
