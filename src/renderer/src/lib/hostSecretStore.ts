// Pattern check: no GoF pattern (-) — rejected — a two-method adapter object over
// the existing secretStore helpers; the Strategy it satisfies is declared in
// @firmware/hostEnv, nothing new is abstracted here.
//
// Hand the firmware system this app's durable secret backend (OS-encrypted
// store over IPC under Electron, localStorage on the web — see ./secretStore).
// Clients that need to persist something across restarts draw on it and supply
// their own key names; the app stays ignorant of what any of them store.
//
// When the desktop has no OS encryption, secretStore refuses to write the value
// in plaintext. The client keeps it in memory for this session only, and the
// user is told once, with what that means and how to fix it.
import { toast } from 'sonner'
import { setHostSecretStore } from '@firmware/hostEnv'
import {
    getSecret,
    SecretStorageUnavailableError,
    setSecret,
} from './secretStore'

const UNAVAILABLE_TOAST_ID = 'host-secret-store-unavailable'

/** Shown once per session when a device credential could not be saved. */
export const SECURE_STORAGE_UNAVAILABLE_MESSAGE =
    "Secure storage is unavailable, so this computer's device pairing could not be saved. It lasts until the app closes; after that the device must be paired again. Set up an OS keyring (for example GNOME Keyring or KWallet) to keep it."

export async function setHostSecret(key: string, value: string): Promise<void> {
    try {
        await setSecret(key, value)
    } catch (e) {
        if (!(e instanceof SecretStorageUnavailableError)) throw e
        toast.warning(SECURE_STORAGE_UNAVAILABLE_MESSAGE, {
            id: UNAVAILABLE_TOAST_ID,
            duration: Infinity,
        })
    }
}

/** Install the app's secret backend into the firmware system. Idempotent —
 *  called on the connect gate, which every connect path awaits. */
export function initHostSecretStore(): void {
    setHostSecretStore({
        // getSecret resolves '' for "not stored"; the port's contract is null.
        get: async (key) => (await getSecret(key)) || null,
        set: setHostSecret,
    })
}
