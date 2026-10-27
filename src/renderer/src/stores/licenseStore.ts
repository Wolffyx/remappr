// Pattern check: no GoF pattern (-) — rejected — zustand store sequencing the
// device key, the secret store, the license Edge Functions and the pure
// verifier; the logic lives in lib/license.
//
// This device's builder license. On start it is verified offline (pinned key,
// this device, this machine, expiry, clock rollback) and the result feeds the
// builder gate. When online it is refreshed at most hourly: a refund, a lapsed
// subscription or a deactivated device comes back `revoked` and the license is
// dropped. Activation needs a signed-in account with a real entitlement.
import { create } from 'zustand'
import { createLogger } from '@shared/logger'
import { IpcChannels } from '@shared/ipc-types'
import { getCloudClient } from '@/lib/cloud/client'
import { cloudErrorMessage } from '@/lib/cloud/errors'
import {
    ENTITLEMENTS_CHANGE_EVENT,
    needsBuilderActivation,
    setBuilderLicenseValid,
} from '@/lib/entitlements'
import { getDeviceKey } from '@/lib/license/deviceKey'
import { licensePublicKey } from '@/lib/license/keys'
import {
    verifyLicense,
    type LicenseClaims,
    type LicenseProblem,
} from '@/lib/license/token'
import { getSecret, setSecret } from '@/lib/secretStore'
import { isElectron } from '@/transport'
import useAuthStore from './authStore'

const log = createLogger('License')

const TOKEN_KEY = 'builderLicense'
const MAX_SEEN_KEY = 'remappr.license.maxSeen'
const LAST_REFRESH_KEY = 'remappr.license.lastRefresh'
const REFRESH_EVERY_MS = 60 * 60 * 1000

export type LicenseStatus = 'none' | 'checking' | 'valid' | 'invalid'

/** Why activation was refused, in the user's words. */
const ACTIVATE_ERRORS: Record<string, string> = {
    not_entitled: 'Your account has no builder purchase yet.',
    device_limit:
        'All your device slots are in use. Deactivate one in Settings → Account.',
    clock_skew: 'This computer’s clock is off. Fix the time and try again.',
    not_authenticated: 'Sign in first.',
}

export interface LicenseState {
    status: LicenseStatus
    claims: LicenseClaims | null
    problem: LicenseProblem | null
    /** This device's sha256(SPKI), once known. */
    deviceHash: string | null
    error: string | null
    /** Verify the stored license; refresh it when online. Idempotent. */
    init: () => Promise<void>
    activate: () => Promise<void>
    refresh: () => Promise<void>
    /** Forget this device's license (sign-out of a shared machine, revoked). */
    clear: () => Promise<void>
}

interface IpcBridge {
    invoke(channel: string, ...args: unknown[]): Promise<unknown>
}

async function machineHash(): Promise<string | null> {
    const api = (globalThis as { api?: IpcBridge }).api
    if (!isElectron() || !api) return null
    const hash = await api.invoke(IpcChannels.LICENSE_MACHINE_HASH)
    return typeof hash === 'string' ? hash : null
}

function platform(): 'web' | 'linux' | 'windows' | 'macos' {
    if (!isElectron()) return 'web'
    const ua = navigator.userAgent
    if (/Windows/.test(ua)) return 'windows'
    if (/Mac OS X/.test(ua)) return 'macos'
    return 'linux'
}

function readNumber(key: string): number {
    try {
        return Number(localStorage.getItem(key)) || 0
    } catch {
        // Storage blocked: behave as if never set.
        return 0
    }
}

function writeNumber(key: string, value: number): void {
    try {
        localStorage.setItem(key, String(value))
    } catch (e) {
        log.warn(`could not store ${key}`, e)
    }
}

/** The latest time this app has seen, moved forward to now. */
function touchMaxSeen(now: number): number {
    const max = Math.max(readNumber(MAX_SEEN_KEY), now)
    writeNumber(MAX_SEEN_KEY, max)
    return max
}

/** The error code an Edge Function answered with, if any. */
async function functionError(error: unknown): Promise<string> {
    const response = (error as { context?: Response }).context
    const body = (await response?.json?.().catch(() => null)) as {
        error?: string
    } | null
    return body?.error ?? cloudErrorMessage(error)
}

let started: Promise<void> | null = null
let autoActivateTried = false

const useLicenseStore = create<LicenseState>()((set, get) => {
    const check = async (token: string): Promise<boolean> => {
        const key = await getDeviceKey()
        const now = Date.now()
        const verdict = verifyLicense(token, {
            device: key.hash,
            machine: await machineHash(),
            now,
            maxSeen: touchMaxSeen(now),
            publicKey: (kid) => licensePublicKey(kid),
        })
        set({
            deviceHash: key.hash,
            status: verdict.ok ? 'valid' : 'invalid',
            claims: verdict.ok ? verdict.claims : null,
            problem: verdict.ok ? null : verdict.problem,
        })
        setBuilderLicenseValid(verdict.ok)
        return verdict.ok
    }

    const store = async (token: string): Promise<void> => {
        await setSecret(TOKEN_KEY, token)
        await check(token)
    }

    return {
        status: 'none',
        claims: null,
        problem: null,
        deviceHash: null,
        error: null,

        init: () => {
            started ??= (async () => {
                set({ status: 'checking' })
                // Once the builder is paid and the plan grants it, activate
                // this device on its own (once per session; the Devices list
                // in Settings → Account explains a refusal).
                window.addEventListener(ENTITLEMENTS_CHANGE_EVENT, () => {
                    if (
                        autoActivateTried ||
                        !needsBuilderActivation() ||
                        !useAuthStore.getState().user
                    )
                        return
                    autoActivateTried = true
                    get()
                        .activate()
                        .catch((e: unknown) =>
                            log.warn('auto-activation failed', e),
                        )
                })
                const token = await getSecret(TOKEN_KEY)
                if (!token) {
                    set({
                        status: 'none',
                        deviceHash: (await getDeviceKey()).hash,
                    })
                    return
                }
                await check(token)
                if (navigator.onLine) await get().refresh()
            })().catch((e: unknown) => {
                log.error('license check failed', e)
                set({ status: 'invalid', error: cloudErrorMessage(e) })
            })
            return started
        },

        activate: async () => {
            const client = await getCloudClient()
            const uid = useAuthStore.getState().user?.id
            if (!client || !uid)
                throw new Error(ACTIVATE_ERRORS.not_authenticated)
            const key = await getDeviceKey()
            const ts = Date.now()
            const { data, error } = await client.functions.invoke<{
                token?: string
            }>('license-activate', {
                body: {
                    devicePublicKey: key.publicKey,
                    proof: await key.sign(`${uid}.${key.hash}.${ts}`),
                    ts,
                    machineHash: await machineHash(),
                    platform: platform(),
                    label: navigator.userAgent.slice(0, 80),
                },
            })
            if (error) {
                const code = await functionError(error)
                set({ error: ACTIVATE_ERRORS[code] ?? code })
                throw new Error(ACTIVATE_ERRORS[code] ?? code)
            }
            if (!data?.token) throw new Error('No license came back')
            set({ error: null })
            writeNumber(LAST_REFRESH_KEY, Date.now())
            await store(data.token)
        },

        refresh: async () => {
            const token = await getSecret(TOKEN_KEY)
            if (!token) return
            if (Date.now() - readNumber(LAST_REFRESH_KEY) < REFRESH_EVERY_MS)
                return
            const client = await getCloudClient()
            if (!client) return
            const { data, error } = await client.functions.invoke<{
                token?: string
                revoked?: boolean
            }>('license-refresh', { body: { token } })
            // Offline or the server is down: keep the license we have.
            if (error) {
                log.warn('license refresh failed', await functionError(error))
                return
            }
            writeNumber(LAST_REFRESH_KEY, Date.now())
            if (data?.revoked) {
                log.info('license revoked')
                await get().clear()
                return
            }
            if (data?.token) await store(data.token)
        },

        clear: async () => {
            await setSecret(TOKEN_KEY, '')
            writeNumber(LAST_REFRESH_KEY, 0)
            set({ status: 'none', claims: null, problem: null })
            setBuilderLicenseValid(false)
        },
    }
})

export default useLicenseStore
