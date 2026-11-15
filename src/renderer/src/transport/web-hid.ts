// Pattern check: Adapter (Tier 1) — extended — bridges navigator.hid (WebHID) into firmware Transport contract; mirrors src/renderer/src/transport/web-serial.ts.
import type { Transport } from '@firmware'
import type { AvailableDevice } from '@/transport/types'
import { registerTransport } from '@/transport/adapter/registry'

export interface HidFilter {
    vendorId?: number
    productId?: number
    usagePage?: number
    usage?: number
}

const deviceRegistry = new Map<string, HIDDevice>()

function makeId(d: HIDDevice, fallbackIndex: number): string {
    return `web-hid:${d.vendorId.toString(16)}:${d.productId.toString(16)}:${fallbackIndex}`
}

function deviceLabel(d: HIDDevice): string {
    if (d.productName && d.productName.trim() !== '') return d.productName
    return `HID ${d.vendorId.toString(16)}:${d.productId.toString(16)}`
}

function hasWebHid(): boolean {
    return typeof navigator !== 'undefined' && 'hid' in navigator
}

function deviceMatchesFilters(d: HIDDevice, filters: HidFilter[]): boolean {
    if (filters.length === 0) return true
    return filters.some((f) => {
        if (f.vendorId !== undefined && d.vendorId !== f.vendorId) return false
        if (f.productId !== undefined && d.productId !== f.productId)
            return false
        if (f.usagePage !== undefined || f.usage !== undefined) {
            const collMatch = d.collections.some((c) => {
                if (f.usagePage !== undefined && c.usagePage !== f.usagePage)
                    return false
                if (f.usage !== undefined && c.usage !== f.usage) return false
                return true
            })
            if (!collMatch) return false
        }
        return true
    })
}

export async function listGrantedDevices(
    filters: HidFilter[],
): Promise<AvailableDevice[]> {
    if (!hasWebHid()) return []
    const devices = await navigator.hid.getDevices()
    deviceRegistry.clear()
    const result: AvailableDevice[] = []
    devices.forEach((d, i) => {
        if (!deviceMatchesFilters(d, filters)) return
        const id = makeId(d, i)
        deviceRegistry.set(id, d)
        result.push({ id, label: deviceLabel(d) })
    })
    return result
}

async function openTransport(device: HIDDevice): Promise<Transport> {
    const { writable: responseWritable, readable } = new TransformStream<
        Uint8Array,
        Uint8Array
    >()
    const responseWriter = responseWritable.getWriter()

    const onInputReport = async (e: HIDInputReportEvent): Promise<void> => {
        const view = e.data
        const buf = new Uint8Array(
            view.buffer,
            view.byteOffset,
            view.byteLength,
        )
        try {
            await responseWriter.write(buf)
        } catch {
            /* stream closed */
        }
    }
    device.addEventListener('inputreport', onInputReport)

    // WebHID fires one navigator-level `disconnect` per unplugged device.
    // Ending the readable on our device's unplug is what lets the client fire
    // onClosed at once, instead of the editor sitting on a gone device until
    // an RPC times out (L4.6).
    const detach = (): void => {
        device.removeEventListener('inputreport', onInputReport)
        navigator.hid.removeEventListener('disconnect', onDisconnect)
    }
    const onDisconnect = (e: Event): void => {
        if ((e as HIDConnectionEvent).device !== device) return
        detach()
        responseWriter.close().catch(() => {})
    }
    navigator.hid.addEventListener('disconnect', onDisconnect)

    if (!device.opened) {
        await device.open().catch((err: unknown) => {
            detach()
            throw err
        })
    }

    let reportId = 0
    for (const c of device.collections) {
        const out = c.outputReports?.[0]
        if (out && typeof out.reportId === 'number') {
            reportId = out.reportId
            break
        }
    }

    const abortController = new AbortController()

    const writable = new WritableStream<Uint8Array>({
        async write(chunk) {
            const copy = new Uint8Array(chunk.byteLength)
            copy.set(chunk)
            await device.sendReport(reportId, copy)
        },
    })

    const abortCb = async (): Promise<void> => {
        detach()
        try {
            await responseWriter.close()
        } catch {
            /* already closed */
        }
        try {
            await device.close()
        } catch {
            /* already closed */
        }
    }
    abortController.signal.addEventListener('abort', abortCb, { once: true })

    return {
        label: deviceLabel(device),
        abortController,
        readable,
        writable,
        vid: device.vendorId,
        pid: device.productId,
    }
}

export async function connectToGrantedDevice(
    device: AvailableDevice,
): Promise<Transport> {
    const d = deviceRegistry.get(device.id)
    if (!d) {
        throw new Error(
            'Selected HID device is no longer available. Refresh the list.',
        )
    }
    return openTransport(d)
}

export async function requestAndConnect(
    filters: HidFilter[],
): Promise<Transport> {
    if (!hasWebHid()) throw new Error('WebHID not supported')
    const devices = await navigator.hid.requestDevice({ filters })
    const d = devices[0]
    if (!d) throw new Error('No HID device selected')
    const id = makeId(d, deviceRegistry.size)
    deviceRegistry.set(id, d)
    return openTransport(d)
}

// pattern-check: skip — sibling capability utility, no abstraction
export async function forgetGrantedDevice(deviceId: string): Promise<void> {
    const d = deviceRegistry.get(deviceId)
    if (!d) return
    const forget = (d as HIDDevice & { forget?: () => Promise<void> }).forget
    if (typeof forget === 'function') {
        await forget.call(d).catch(() => undefined)
    }
    deviceRegistry.delete(deviceId)
}

export function onDevicesChanged(cb: () => void): () => void {
    if (!hasWebHid()) return () => undefined
    const handler = (): void => cb()
    navigator.hid.addEventListener('connect', handler)
    navigator.hid.addEventListener('disconnect', handler)
    return () => {
        navigator.hid.removeEventListener('connect', handler)
        navigator.hid.removeEventListener('disconnect', handler)
    }
}

registerTransport({
    id: 'web:hid',
    envs: 'web',
    create(ctx) {
        if (!hasWebHid()) return null
        const filters = ctx.hidFilters()
        return {
            label: 'HID',
            communication: 'hid',
            pick_and_connect: {
                list: () => listGrantedDevices(filters),
                connect: connectToGrantedDevice,
            },
            request_new: () => requestAndConnect(filters),
            forgetDevice: (device) => forgetGrantedDevice(device.id),
        }
    },
    subscribeChanges(_ctx, cb) {
        return onDevicesChanged(cb)
    },
})
