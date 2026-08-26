// Pattern check: no GoF pattern (-) — rejected — a two-method adapter object over
// the existing secretStore helpers; the Strategy it satisfies is declared in
// @firmware/hostEnv, nothing new is abstracted here.
//
// Hand the firmware system this app's durable secret backend (OS-encrypted
// store over IPC under Electron, localStorage on the web — see ./secretStore).
// Clients that need to persist something across restarts draw on it and supply
// their own key names; the app stays ignorant of what any of them store.
import { setHostSecretStore } from '@firmware/hostEnv'
import { getSecret, setSecret } from './secretStore'

/** Install the app's secret backend into the firmware system. Idempotent —
 *  called on the connect gate, which every connect path awaits. */
export function initHostSecretStore(): void {
    setHostSecretStore({
        // getSecret resolves '' for "not stored"; the port's contract is null.
        get: async (key) => (await getSecret(key)) || null,
        set: (key, value) => setSecret(key, value),
    })
}
