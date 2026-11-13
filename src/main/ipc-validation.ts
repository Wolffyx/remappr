/**
 * Input validation utilities for IPC handlers.
 * Validates payloads received from the renderer to ensure type safety
 * and prevent malicious or malformed data from being processed.
 */

import type { AvailableDevice, LinkId } from '../shared/ipc-types'

export function isAvailableDevice(value: unknown): value is AvailableDevice {
    return (
        typeof value === 'object' &&
        value !== null &&
        typeof (value as Record<string, unknown>).label === 'string' &&
        typeof (value as Record<string, unknown>).id === 'string'
    )
}

export function validateAvailableDevice(value: unknown): AvailableDevice {
    if (!isAvailableDevice(value)) {
        throw new Error(
            'Invalid device payload: expected { label: string, id: string }',
        )
    }
    return value
}

// Hard upper bound on any single IPC byte payload. ZMK RPC frames sit well
// under 4 KiB; HID/BLE write chunks are MTU-bounded; firmware-blob uploads
// run through a different IPC channel. 64 KiB is a comfortable ceiling that
// still rejects accidental or malicious multi-MB floods from a compromised
// renderer before they reach native modules.
const MAX_IPC_BYTES = 64 * 1024

export function validateUint8Array(value: unknown): Uint8Array {
    let arr: Uint8Array
    if (value instanceof Uint8Array) {
        arr = value
    } else if (Buffer.isBuffer(value)) {
        // IPC serialization on the main side may surface as a Node Buffer.
        arr = new Uint8Array(value)
    } else if (
        typeof value === 'object' &&
        value !== null &&
        'type' in value &&
        (value as Record<string, unknown>).type === 'Buffer' &&
        Array.isArray((value as Record<string, unknown>).data)
    ) {
        const data = (value as Record<string, unknown>).data as unknown[]
        for (const b of data) {
            if (
                typeof b !== 'number' ||
                !Number.isInteger(b) ||
                b < 0 ||
                b > 255
            ) {
                throw new Error(
                    'Invalid data payload: byte out of range (0–255)',
                )
            }
        }
        arr = new Uint8Array(data as number[])
    } else {
        throw new Error('Invalid data payload: expected Uint8Array or Buffer')
    }

    if (arr.length > MAX_IPC_BYTES) {
        throw new Error(
            `Invalid data payload: ${arr.length} bytes exceeds ${MAX_IPC_BYTES}-byte cap`,
        )
    }
    return arr
}

export function validateLinkId(value: unknown): LinkId {
    if (typeof value !== 'number' || !Number.isInteger(value) || value < 1) {
        throw new Error('Invalid link id: expected a positive integer')
    }
    return value
}
