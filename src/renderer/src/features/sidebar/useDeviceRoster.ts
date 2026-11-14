// Pattern check: no GoF pattern (-) — rejected — a hook merging three device sources (listed transports, dongle nodes, demo set) into one RosterEntry list; each source is one small builder function.
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Bluetooth, Keyboard, Usb, type LucideIcon } from 'lucide-react'
import { DEMO_DEVICES, type DemoDeviceId } from '@firmware'
import type { DeviceForm, DeviceKind } from '@firmware/devices/types'
import type { NodeView } from '@firmware/service'
import { getTransports, subscribeToTransportChanges } from '@/lib/transports'
import { FORM_LABEL } from '@/lib/devices/labels'
import { switchToDevice } from '@/features/connection/connectTransport'
import { listDevices } from '@/features/connection/listDevices'
import { deviceKey } from '@/features/connection/deviceKey'
import { nodeKey, useNodeRoster } from '@/features/connection/nodeRoster'
import type { DeviceWithTransport } from '@/features/connection/types'
import {
    connectDemo,
    useActiveDemo,
} from '@/features/connection/demo/connectDemo'
import { FORM_ICON, KIND_ICON } from '@/features/devices/formIcons'
import useConnectionStore from '@/stores/connectionStore'
import useDevicePreviewStore, {
    type DevicePreviewSnapshot,
} from '@/stores/devicePreviewStore'
import useUserSettingsStore from '@/stores/userSettingsStore'
import { shownBattery } from '@/features/battery/battery'
import { useDeviceBattery } from '@/features/battery/useDeviceBattery'
import type { RosterEntry, RosterGroup, RosterKind } from './roster'

const FORM_KIND: Readonly<Record<DeviceForm, RosterKind>> = {
    keyboard: 'keyboard',
    macropad: 'keyboard',
    mouse: 'mouse',
    gamepad: 'pad',
    flightstick: 'stick',
}

const NODE_KIND: Readonly<Record<DeviceKind, RosterKind>> = {
    keyboard: 'keyboard',
    mouse: 'mouse',
    joystick: 'pad',
    dongle: 'other',
}

const NODE_LABEL: Readonly<Record<DeviceKind, string>> = {
    keyboard: 'Keyboard',
    mouse: 'Mouse',
    joystick: 'Joystick',
    dongle: 'Dongle',
}

const USB: RosterGroup = { id: 'usb', label: 'USB', kind: 'direct' }
const BLE: RosterGroup = { id: 'ble', label: 'Bluetooth', kind: 'direct' }
const DEMO: RosterGroup = { id: 'demo', label: 'Demo devices', kind: 'demo' }

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

/** How a node is reached now: through the dongle once its session is up. */
function nodeLink(n: NodeView): string {
    if (n.secured) return 'via dongle'
    return n.online ? 'connecting' : 'asleep'
}

/** What the last session on a device saw of it, else how it is attached. */
function describe(
    d: DeviceWithTransport,
    snapshot: DevicePreviewSnapshot | undefined,
): { icon: LucideIcon; label: string; kind: RosterKind } {
    const form = snapshot?.device?.model.form
    if (form)
        return {
            icon: FORM_ICON[form],
            label: FORM_LABEL[form],
            kind: FORM_KIND[form],
        }
    if (snapshot) return { icon: Keyboard, label: 'Keyboard', kind: 'keyboard' }
    if (d.transport.isWireless)
        return { icon: Bluetooth, label: 'Device', kind: 'other' }
    return { icon: Usb, label: 'Device', kind: 'other' }
}

function demoEntries(activeId: DemoDeviceId | null): RosterEntry[] {
    return DEMO_DEVICES.map((d) => ({
        key: `demo:${d.id}`,
        name: d.name,
        detail: `${FORM_LABEL[d.form]}${d.ready ? '' : ' · no layout'}`,
        icon: FORM_ICON[d.form],
        kind: FORM_KIND[d.form],
        group: DEMO,
        online: true,
        active: d.id === activeId,
        open: () => connectDemo(d.id),
    }))
}

/**
 * Every device the editor can switch to now, the open one marked active.
 * Opening an entry asks about unsaved edits first, like every device switch.
 */
export function useDeviceRoster(): {
    entries: RosterEntry[]
    refresh: () => void
} {
    const service = useConnectionStore((s) => s.service)
    const parentService = useConnectionStore((s) => s.parentService)
    const activeNodeId = useConnectionStore((s) => s.activeNodeId)
    const currentId = useConnectionStore((s) => s.lastConnectedDevice?.id)
    const currentKey = useConnectionStore((s) => s.lastConnectedDevice?.key)
    const deviceName = useConnectionStore((s) => s.deviceName)
    const openNode = useConnectionStore((s) => s.openNode)
    const returnToParent = useConnectionStore((s) => s.returnToParent)
    const snapshots = useDevicePreviewStore((s) => s.snapshots)
    const activeDemo = useActiveDemo((s) => s.id)
    const markDeviceUsed = useUserSettingsStore((s) => s.markDeviceUsed)

    const demo = !!service?.capabilities.demo
    const listed = useListedDevices(!!service && !demo)
    const dongle = parentService ?? service
    // The dongle landing's roster too: polled, and a failed read keeps the
    // last good list.
    const roster = useNodeRoster(demo ? undefined : dongle?.nodes)
    const nodes = roster.nodes
    const refreshRoster = roster.refresh
    const refresh = useCallback((): void => {
        refreshRoster().catch((e: unknown) => {
            console.warn('Failed to list nodes', e)
        })
    }, [refreshRoster])
    // The open device's own reading: its threshold, and fresher than a roster.
    const battery = useDeviceBattery(service)

    const entries = useMemo((): RosterEntry[] => {
        if (!service) return []
        if (demo) {
            return demoEntries(activeDemo).map((e) =>
                e.active && battery ? { ...e, battery } : e,
            )
        }
        const out: RosterEntry[] = listed.map((d) => {
            const key = deviceKey(d.device)
            const { icon, label, kind } = describe(d, snapshots[key])
            const current = d.device.id === currentId
            const via = d.transport.isWireless ? 'Bluetooth' : 'USB'
            return {
                key: `dev:${key}`,
                name: d.device.label,
                detail: `${label} · ${via}`,
                icon,
                kind,
                group: d.transport.isWireless ? BLE : USB,
                online: true,
                active: current && !parentService,
                ...(current && !parentService && battery ? { battery } : {}),
                open: async (): Promise<void> => {
                    if (current && parentService) return returnToParent()
                    if (current) return
                    await switchToDevice(d)
                },
            }
        })
        const dongleName = dongle?.deviceInfo.name?.trim() || 'Dongle'
        const dongleId = currentKey ?? dongleName
        const dongleGroup: RosterGroup = {
            id: `dongle:${dongleId}`,
            label: dongleName,
            kind: 'dongle',
        }
        for (const n of nodes) {
            const kindLabel = n.kind ? NODE_LABEL[n.kind] : 'Node'
            const active = n.id === activeNodeId
            const nodeBattery =
                active && battery
                    ? battery
                    : n.battery
                      ? shownBattery(n.battery)
                      : undefined
            out.push({
                key: `node:${dongleId}:${nodeKey(n)}`,
                name: n.label,
                detail: `${kindLabel} · ${nodeLink(n)}`,
                icon: n.kind ? KIND_ICON[n.kind] : Keyboard,
                kind: n.kind ? NODE_KIND[n.kind] : 'other',
                group: dongleGroup,
                // Opening relays through the node's secure session.
                online: n.secured,
                active,
                ...(nodeBattery ? { battery: nodeBattery } : {}),
                open: () => openNode(n.id),
            })
        }
        if (out.some((e) => e.active)) return out
        // A device not on any listable transport (web simple-connect): still
        // the one being edited, so it leads the roster.
        const name = deviceName?.trim() || service.deviceInfo.name || 'Device'
        return [
            {
                key: `self:${name}`,
                name,
                detail: service.deviceInfo.firmware,
                icon: Keyboard,
                kind: 'keyboard',
                group: USB,
                online: true,
                active: true,
                ...(battery ? { battery } : {}),
                open: async () => {},
            },
            ...out,
        ]
    }, [
        service,
        demo,
        activeDemo,
        listed,
        snapshots,
        currentId,
        currentKey,
        parentService,
        returnToParent,
        dongle,
        nodes,
        activeNodeId,
        openNode,
        deviceName,
        battery,
    ])

    const activeKey = entries.find((e) => e.active)?.key
    useEffect(() => {
        if (activeKey) markDeviceUsed(activeKey)
    }, [activeKey, markDeviceUsed])

    return { entries, refresh }
}
