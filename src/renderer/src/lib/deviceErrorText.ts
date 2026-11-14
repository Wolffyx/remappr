// Pattern check: Dispatch Map (Tier 0) — applied — device status name → user
// text + remediation hint, one table instead of a switch over every code.
//
// Turn a save / device error into words a user can act on. Clients throw the
// device's raw status ("WRITE_CONFIG_BEGIN failed: ERR_AUTH"); that tells a
// developer which step failed, but not the user what to do. The status name is
// kept in the hint, so a bug report still carries it.

/** What to show for a failed device operation. */
export interface DeviceErrorText {
    /** One line: what went wrong. */
    message: string
    /** What the user can do about it, plus the raw status for reports. */
    hint?: string
}

interface StatusText {
    message: string
    hint: string
}

const STATUS_TEXT: Record<string, StatusText> = {
    ERR_AUTH: {
        message: 'The device did not accept this computer.',
        hint: 'It is not paired with this computer, or it is paired with another one. Reconnect to pair again. If it keeps refusing, clear the pairing on the device and reconnect.',
    },
    ERR_VERSION: {
        message: 'The config on the device changed since it was read.',
        hint: 'Another app or computer may have saved to it. Reconnect to load the current config, then make your change again.',
    },
    ERR_ACTIVATE: {
        message: 'The device stored the config but could not apply it.',
        hint: 'It keeps running its previous config. A setting may be one this firmware cannot use: undo the last change, or update the firmware, and save again.',
    },
    ERR_STORAGE: {
        message: 'The device could not write its storage.',
        hint: 'Save again. If it keeps failing, the config may be too large for the device, or its storage may be worn.',
    },
    ERR_INVALID: {
        message: 'The device rejected the config as invalid.',
        hint: 'Undo the last change and save again, or update the firmware.',
    },
    ERR_STATE: {
        message: 'The device was busy with another save.',
        hint: 'Wait a moment and save again.',
    },
    ERR_ARG: {
        message: 'The device did not understand the request.',
        hint: 'The firmware may be older than this app. Update the firmware and try again.',
    },
    ERR_CMD: {
        message: 'The device does not support this request.',
        hint: 'The firmware may be older than this app. Update the firmware and try again.',
    },
}

/** The client's preflight line for a config bigger than the device stores. */
const OVERSIZE = /bytes but this device (stores|accepts) at most/
/** The client's prefix for a save it refused before writing anything. */
const NOT_SAVED_PREFIX = 'The config was not saved: '

const STATUS_TOKEN = /\bERR_[A-Z]+\b/

function rawMessage(e: unknown, fallback: string): string {
    if (e instanceof Error && e.message) return e.message
    if (typeof e === 'string' && e) return e
    return fallback
}

/** Describe `e` for the user. Unknown errors keep their own message. */
export function describeDeviceError(
    e: unknown,
    fallback = 'The device did not answer.',
): DeviceErrorText {
    const raw = rawMessage(e, fallback)
    const status = raw.match(STATUS_TOKEN)?.[0]
    const known = status ? STATUS_TEXT[status] : undefined
    if (known) {
        return {
            message: known.message,
            hint: `${known.hint} (Device status: ${status})`,
        }
    }
    if (OVERSIZE.test(raw)) {
        return {
            message: 'The config is too large for this device.',
            hint: `Remove some macros, layers or other entries, then save again. (${stripNotSaved(raw)})`,
        }
    }
    if (raw.startsWith(NOT_SAVED_PREFIX)) {
        return {
            message: 'The config was not saved.',
            hint: `${stripNotSaved(raw)}. Nothing was written to the device; fix this and save again.`,
        }
    }
    return { message: raw }
}

function stripNotSaved(raw: string): string {
    return raw.startsWith(NOT_SAVED_PREFIX)
        ? raw.slice(NOT_SAVED_PREFIX.length)
        : raw
}
