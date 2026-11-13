// Pattern check: no GoF pattern (-) — rejected — a hook merging three device sources (listed transports, dongle nodes, demo set) into one RosterEntry list; each source is one small builder function.
import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Bluetooth, Keyboard, Usb, type LucideIcon } from 'lucide-react'
import { DEMO_DEVICES, type DemoDeviceId } from '@firmware'
import type { DeviceForm, DeviceKind } from '@firmware/devices/types'
import type { KeyboardService, NodeView } from '@firmware/service'
import { getTransports, subscribeToTransportChanges } from '@/lib/transports'
import { FORM_LABEL } from '@/lib/devices/labels'
import { switchToDevice } from '@/features/connection/connectTransport'
import { listDevices } from '@/features/connection/listDevices'
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
import {
    BATTERY_POLL_MS,
    useDeviceBattery,
} from '@/features/battery/useDeviceBattery'
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

/** The nodes behind the connected dongle, re-listed now and then so their
 *  link and battery stay current; empty for any other device. */
function useDongleNodes(dongle: KeyboardService | null): {
    nodes: NodeView[]
    refresh: () => void
} {
    const [nodes, setNodes] = useState<NodeView[]>([])
    const [tick, setTick] = useState(0)
    const api = dongle?.nodes
    useEffect(() => {
        if (!api) return
        let live = true
        api.list().then(
            (found) => {
                if (live) setNodes(found)
            },
            (e: unknown) => {
                console.warn('Failed to list nodes', e)
                if (live) setNodes([])
            },
        )
        return (): void => {
            live = false
        }
    }, [api, tick])
    useEffect(() => {
        if (!api) return
        const id = setInterval(() => setTick((t) => t + 1), BATTERY_POLL_MS)
        return (): void => clearInterval(id)
    }, [api])
    const refresh = useCallback((): void => setTick((t) => t + 1), [])
    return { nodes: api ? nodes : [], refresh }
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

/**
 * The listed device a connection without a known id came from (a browser
 * pick): the only one on its kind of transport carrying the connected
 * device's name. Undefined when none or several do.
 */
function matchListed(
    listed: readonly DeviceWithTransport[],
    name: string,
    communication: string | null,
): string | undefined {
    const hits = listed.filter(
        (d) =>
            d.transport.communication === communication &&
            d.device.label.trim() === name,
    )
    return hits.length === 1 ? hits[0].device.id : undefined
}

/** Open a node through its dongle; a refusal (an asleep or busy node) says
 *  why instead of failing silently. */
async function openNodeOrToast(
    openNode: (id: number) => Promise<void>,
    id: number,
): Promise<void> {
    try {
        await openNode(id)
    } catch (e) {
        toast.error('Failed to open the device', {
            description: e instanceof Error ? e.message : String(e),
        })
    }
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
    const deviceName = useConnectionStore((s) => s.deviceName)
    const communication = useConnectionStore((s) => s.communication)
    const openNode = useConnectionStore((s) => s.openNode)
    const returnToParent = useConnectionStore((s) => s.returnToParent)
    const snapshots = useDevicePreviewStore((s) => s.snapshots)
    const activeDemo = useActiveDemo((s) => s.id)
    const markDeviceUsed = useUserSettingsStore((s) => s.markDeviceUsed)

    const demo = !!service?.capabilities.demo
    const listed = useListedDevices(!!service && !demo)
    const dongle = parentService ?? service
    const { nodes, refresh } = useDongleNodes(demo ? null : dongle)
    // The open device's own reading: its threshold, and fresher than a roster.
    const battery = useDeviceBattery(service)

    const entries = useMemo((): RosterEntry[] => {
        if (!service) return []
        if (demo) {
            return demoEntries(activeDemo).map((e) =>
                e.active && battery ? { ...e, battery } : e,
            )
        }
        const name = deviceName?.trim() || service.deviceInfo.name || 'Device'
        const selfId = currentId ?? matchListed(listed, name, communication)
        const out: RosterEntry[] = listed.map((d) => {
            const { icon, label, kind } = describe(d, snapshots[d.device.id])
            const current = d.device.id === selfId
            const via = d.transport.isWireless ? 'Bluetooth' : 'USB'
            return {
                key: `dev:${d.device.id}`,
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
        const dongleGroup: RosterGroup = {
            id: `dongle:${currentId ?? dongleName}`,
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
                key: `node:${currentId ?? dongleName}:${n.id}`,
                name: n.label,
                detail: `${kindLabel} · ${n.online ? 'via dongle' : 'asleep'}`,
                icon: n.kind ? KIND_ICON[n.kind] : Keyboard,
                kind: n.kind ? NODE_KIND[n.kind] : 'other',
                group: dongleGroup,
                online: n.online,
                active,
                ...(nodeBattery ? { battery: nodeBattery } : {}),
                open: () => openNodeOrToast(openNode, n.id),
            })
        }
        if (out.some((e) => e.active)) return out
        // A device not on any listable transport (web simple-connect): still
        // the one being edited, so it leads the roster.
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
        parentService,
        returnToParent,
        dongle,
        nodes,
        activeNodeId,
        openNode,
        deviceName,
        communication,
        battery,
    ])

    const activeKey = entries.find((e) => e.active)?.key
    useEffect(() => {
        if (activeKey) markDeviceUsed(activeKey)
    }, [activeKey, markDeviceUsed])

    return { entries, refresh }
}
