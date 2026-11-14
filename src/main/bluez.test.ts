// pattern-check: skip — unit test with dbus-next faked, no production logic
import { EventEmitter } from 'node:events'
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest'

const DEV = '/org/bluez/hci0/dev_AA_BB_CC_DD_EE_FF'
const SVC_PATH = `${DEV}/service0010`
const CHAR_PATH = `${SVC_PATH}/char0011`
const SVC = '00000000-0196-6107-c967-c5cfb1c2482a'
const CHR = '00000001-0196-6107-c967-c5cfb1c2482a'

const v = (value: unknown): { value: unknown } => ({ value })

/* The slice of a dbus-next MessageBus that bluez.ts drives. */
const fake = vi.hoisted(() => ({
    connected: true,
    startNotifyError: null as Error | null,
    calls: [] as string[],
    bus: null as unknown as {
        _signals: EventEmitter
        _addMatch: (rule: string) => Promise<void>
        _removeMatch: (rule: string) => Promise<void>
        getProxyObject: (svc: string, path: string) => Promise<unknown>
        matches: Set<string>
    },
}))

function makeBus(): typeof fake.bus {
    const matches = new Set<string>()
    const iface = (path: string, name: string): Record<string, unknown> => {
        const call =
            (m: string, ret?: unknown) => async (): Promise<unknown> => {
                fake.calls.push(`${name.split('.').pop()}.${m}`)
                return ret
            }
        if (name === 'org.freedesktop.DBus.ObjectManager') {
            return {
                GetManagedObjects: async () => ({
                    [DEV]: {
                        'org.bluez.Device1': {
                            UUIDs: v([SVC]),
                            Connected: v(fake.connected),
                            Name: v('Remappr'),
                        },
                    },
                    [SVC_PATH]: { 'org.bluez.GattService1': { UUID: v(SVC) } },
                    [CHAR_PATH]: {
                        'org.bluez.GattCharacteristic1': { UUID: v(CHR) },
                    },
                }),
            }
        }
        if (name === 'org.freedesktop.DBus.Properties') {
            return {
                Get: async (_i: string, prop: string) => {
                    const props: Record<string, unknown> = {
                        Connected: fake.connected,
                        ServicesResolved: true,
                        Name: 'Remappr',
                        Flags: ['read', 'write', 'indicate'],
                        Notifying: true,
                    }
                    return v(props[prop])
                },
            }
        }
        if (name === 'org.bluez.Device1') {
            return {
                Connect: async () => {
                    fake.calls.push('Device1.Connect')
                    fake.connected = true
                },
                Disconnect: call('Disconnect'),
            }
        }
        if (name === 'org.bluez.GattCharacteristic1') {
            return {
                StartNotify: async () => {
                    fake.calls.push('GattCharacteristic1.StartNotify')
                    if (fake.startNotifyError) throw fake.startNotifyError
                },
                StopNotify: call('StopNotify'),
                ReadValue: call('ReadValue', Buffer.from([])),
                WriteValue: call('WriteValue'),
            }
        }
        throw new Error(`no interface ${name} at ${path}`)
    }
    return {
        matches,
        _signals: new EventEmitter(),
        _addMatch: async (rule) => {
            matches.add(rule)
        },
        _removeMatch: async (rule) => {
            matches.delete(rule)
        },
        getProxyObject: async (_svc, path) => ({
            getInterface: (name: string) => iface(path, name),
        }),
    }
}

vi.mock('node:module', () => ({
    createRequire: () => (id: string) => {
        if (id !== 'dbus-next') throw new Error(`unexpected require ${id}`)
        return { systemBus: () => fake.bus }
    },
}))

fake.bus = makeBus()

import {
    connectGattDevice,
    disconnectGattDevice,
    hasActiveBluezConnection,
    listGattDevices,
} from './bluez'

const CHAR_KEY = JSON.stringify({
    path: CHAR_PATH,
    interface: 'org.freedesktop.DBus.Properties',
    member: 'PropertiesChanged',
})
const DEV_KEY = JSON.stringify({
    path: DEV,
    interface: 'org.freedesktop.DBus.Properties',
    member: 'PropertiesChanged',
})

const notify = (bytes: number[]): void => {
    fake.bus._signals.emit(CHAR_KEY, {
        path: CHAR_PATH,
        body: [
            'org.bluez.GattCharacteristic1',
            { Value: v(Buffer.from(bytes)) },
        ],
    })
}

const callbacks = (): {
    onData: Mock<(data: number[]) => void>
    onDisconnected: Mock<() => void>
} => ({
    onData: vi.fn<(data: number[]) => void>(),
    onDisconnected: vi.fn<() => void>(),
})

const connect = (cb = callbacks()): Promise<string> =>
    connectGattDevice(DEV, SVC, CHR, cb)

beforeEach(async () => {
    await disconnectGattDevice()
    fake.connected = true
    fake.startNotifyError = null
    fake.calls.length = 0
    await listGattDevices(SVC)
})

describe('BlueZ GATT transport', () => {
    it('leaves a link the OS made up when the session closes (L4.5)', async () => {
        await connect()
        await disconnectGattDevice()
        expect(fake.calls).not.toContain('Device1.Connect')
        expect(fake.calls).not.toContain('Device1.Disconnect')
        expect(fake.calls).toContain('GattCharacteristic1.StopNotify')
    })

    it('drops a link it made itself when the session closes', async () => {
        // Listed while connected, then the OS link dropped before Open.
        fake.connected = false
        await connect()
        await disconnectGattDevice()
        expect(fake.calls).toContain('Device1.Connect')
        expect(fake.calls).toContain('Device1.Disconnect')
    })

    it('removes its signal handlers when the connect fails (L4.4)', async () => {
        fake.startNotifyError = new Error('Not permitted')
        await expect(connect()).rejects.toThrow('Not permitted')

        expect(fake.bus._signals.listenerCount(CHAR_KEY)).toBe(0)
        expect(fake.bus._signals.listenerCount(DEV_KEY)).toBe(0)
        expect(fake.bus.matches.size).toBe(0)
        expect(hasActiveBluezConnection()).toBe(false)
    })

    it('drops a link it made when the connect then fails', async () => {
        fake.connected = false
        fake.startNotifyError = new Error('Not permitted')
        await expect(connect()).rejects.toThrow()
        expect(fake.calls).toContain('Device1.Disconnect')
    })

    it('keeps an OS link when the connect fails', async () => {
        fake.startNotifyError = new Error('Not permitted')
        await expect(connect()).rejects.toThrow()
        expect(fake.calls).not.toContain('Device1.Disconnect')
    })

    it('delivers each notification once after a failed connect', async () => {
        // Both connects feed one sink, as both reach the same renderer.
        const cb = callbacks()
        fake.startNotifyError = new Error('Not permitted')
        await expect(connect(cb)).rejects.toThrow()
        fake.startNotifyError = null
        await connect(cb)

        notify([1, 2, 3])

        expect(cb.onData).toHaveBeenCalledTimes(1)
        expect(cb.onData).toHaveBeenCalledWith([1, 2, 3])
    })

    it('restores the bus signal emitter on every close', async () => {
        const original = fake.bus._signals.emit
        await connect()
        await disconnectGattDevice()
        await connect()
        await disconnectGattDevice()
        expect(fake.bus._signals.emit).toBe(original)
        expect(fake.bus._signals.listenerCount(CHAR_KEY)).toBe(0)
        expect(fake.bus.matches.size).toBe(0)
    })

    it('reports the device dropping its link', async () => {
        const cb = callbacks()
        await connect(cb)
        fake.bus._signals.emit(DEV_KEY, {
            path: DEV,
            body: ['org.bluez.Device1', { Connected: v(false) }],
        })
        expect(cb.onDisconnected).toHaveBeenCalledTimes(1)
    })
})
