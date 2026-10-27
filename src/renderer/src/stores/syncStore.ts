// Pattern check: no GoF pattern (-) — rejected — zustand store wiring auth,
// timers and the library store to the sync engine (which holds the Strategy).
//
// When the library syncs. The choice is per account (asked on the first
// sign-in, changeable in Settings → Account). While on: a local save pushes
// after 2 s; sign-in, window focus and every 5 minutes pull then push. Signing
// out pauses sync and keeps the local copies.
import { create } from 'zustand'
import { toast } from 'sonner'
import { createLogger } from '@shared/logger'
import { getCloudClient } from '@/lib/cloud/client'
import { cloudErrorMessage } from '@/lib/cloud/errors'
import { createCloudLibrary } from '@/lib/library/cloudLibrary'
import {
    createSyncEngine,
    type ConflictChoice,
    type SyncEngine,
} from '@/lib/library/syncEngine'
import type { LibraryEntry, NewLibraryEntry } from '@/lib/library/types'
import useAuthStore from './authStore'
import useLibraryStore, { libraryRepository } from './libraryStore'

const log = createLogger('Sync')

export type SyncChoice = 'on' | 'off'
export type SyncStatus = 'paused' | 'idle' | 'syncing' | 'error'

const PUSH_DELAY_MS = 2000
const PULL_EVERY_MS = 5 * 60 * 1000

export interface SyncQuota {
    used: number
    limit: number
}

export interface SyncState {
    status: SyncStatus
    /** This account's choice; null = not asked yet. */
    choice: SyncChoice | null
    /** Show the "sync your library?" dialog. */
    asking: boolean
    error: string | null
    lastSyncedAt: number | null
    /** Local entries whose cloud item was deleted elsewhere. */
    tombstones: LibraryEntry[]
    quota: SyncQuota | null
    /** Start following sign-in. Idempotent. */
    start: () => void
    /** Sync these entries (the rest stay on this device), then keep syncing. */
    enable: (localIds: readonly string[]) => Promise<void>
    /** Keep everything local for this account. */
    disable: () => void
    /** Close the dialog; ask again next sign-in. */
    postpone: () => void
    syncNow: () => Promise<void>
    resolveConflict: (localId: string, choice: ConflictChoice) => Promise<void>
    /** A cloud delete: drop the local copy too, or keep it on this device. */
    settleTombstone: (localId: string, keep: boolean) => Promise<void>
    /** Delete a synced entry here and in the cloud. */
    removeEverywhere: (localId: string) => Promise<void>
    /** Shared PCs: drop the local copies of this account's synced entries. */
    removeCloudCopies: () => Promise<void>
    refreshQuota: () => Promise<void>
    /** The cloud side of a conflict, for the conflict dialog. */
    cloudCopy: (localId: string) => Promise<NewLibraryEntry | null>
}

function choiceKey(accountId: string): string {
    return `remappr.sync.${accountId}`
}
function cursorKey(accountId: string): string {
    return `remappr.sync.cursor.${accountId}`
}

function readStorage(key: string): string | null {
    try {
        return localStorage.getItem(key)
    } catch {
        // Storage blocked: treated as never set.
        return null
    }
}
function writeStorage(key: string, value: string): void {
    try {
        localStorage.setItem(key, value)
    } catch (e) {
        log.warn(`could not store ${key}`, e)
    }
}

function accountId(): string | null {
    return useAuthStore.getState().user?.id ?? null
}

let engine: { account: string; engine: SyncEngine } | null = null
let pushTimer: ReturnType<typeof setTimeout> | null = null
let pullTimer: ReturnType<typeof setInterval> | null = null
let started = false

async function engineFor(account: string): Promise<SyncEngine | null> {
    if (engine?.account === account) return engine.engine
    const client = await getCloudClient()
    if (!client) return null
    engine = {
        account,
        engine: createSyncEngine(
            libraryRepository,
            createCloudLibrary(client),
            account,
        ),
    }
    return engine.engine
}

const useSyncStore = create<SyncState>()((set, get) => {
    const running = (): boolean => get().choice === 'on' && !!accountId()

    const fail = (e: unknown): void => {
        const message = cloudErrorMessage(e)
        log.error('sync failed', message)
        set({ status: 'error', error: message })
    }

    const pushSoon = (): void => {
        if (!running()) return
        if (pushTimer) clearTimeout(pushTimer)
        pushTimer = setTimeout(() => {
            pushTimer = null
            void pushNow()
        }, PUSH_DELAY_MS)
    }

    const pushNow = async (): Promise<void> => {
        const account = accountId()
        const sync = account && running() ? await engineFor(account) : null
        if (!sync) return
        try {
            const { attempted } = await sync.pushPending()
            if (attempted > 0) await useLibraryStore.getState().load()
            set({ status: 'idle', error: null, lastSyncedAt: Date.now() })
        } catch (e) {
            fail(e)
        }
    }

    const stopTimers = (): void => {
        if (pushTimer) clearTimeout(pushTimer)
        if (pullTimer) clearInterval(pullTimer)
        pushTimer = null
        pullTimer = null
    }

    const startTimers = (): void => {
        stopTimers()
        pullTimer = setInterval(() => void get().syncNow(), PULL_EVERY_MS)
    }

    const onAccount = (account: string | null): void => {
        stopTimers()
        if (!account) {
            set({
                status: 'paused',
                choice: null,
                asking: false,
                tombstones: [],
                quota: null,
            })
            return
        }
        const stored = readStorage(choiceKey(account))
        const choice = stored === 'on' || stored === 'off' ? stored : null
        set({
            choice,
            asking: choice === null,
            status: choice === 'on' ? 'idle' : 'paused',
        })
        if (choice !== 'on') return
        startTimers()
        void get().syncNow()
    }

    const saveChoice = (choice: SyncChoice): string | null => {
        const account = accountId()
        if (!account) return null
        writeStorage(choiceKey(account), choice)
        set({ choice, asking: false })
        return account
    }

    return {
        status: 'paused',
        choice: null,
        asking: false,
        error: null,
        lastSyncedAt: null,
        tombstones: [],
        quota: null,

        start: () => {
            if (started) return
            started = true
            useAuthStore.subscribe((s, prev) => {
                if (s.user?.id !== prev.user?.id) onAccount(s.user?.id ?? null)
            })
            onAccount(accountId())
            // Any local save or edit: push it soon (the engine skips clean entries).
            useLibraryStore.subscribe((s, prev) => {
                if (s.entries !== prev.entries) pushSoon()
            })
            window.addEventListener('focus', () => {
                if (running()) void get().syncNow()
            })
        },

        enable: async (localIds) => {
            await useLibraryStore.getState().load()
            const chosen = new Set(localIds)
            for (const e of useLibraryStore.getState().entries) {
                if (
                    e.sync.itemId ||
                    chosen.has(e.localId) === !e.sync.localOnly
                )
                    continue
                await libraryRepository.put({
                    ...e,
                    sync: { ...e.sync, localOnly: !chosen.has(e.localId) },
                })
            }
            if (!saveChoice('on')) return
            set({ status: 'idle' })
            startTimers()
            await get().syncNow()
            const refused = useLibraryStore
                .getState()
                .entries.filter(
                    (e) =>
                        e.sync.state === 'over_quota' ||
                        e.sync.state === 'needs_builder',
                )
            if (refused.length)
                toast.info(
                    `${refused.length} entr${refused.length === 1 ? 'y stays' : 'ies stay'} on this device`,
                    {
                        description:
                            'They are over your plan’s cloud limit. Delete some cloud items or upgrade to sync them.',
                    },
                )
        },

        disable: () => {
            if (!saveChoice('off')) return
            stopTimers()
            set({ status: 'paused' })
        },

        postpone: () => set({ asking: false }),

        syncNow: async () => {
            const account = accountId()
            const sync = account && running() ? await engineFor(account) : null
            if (!sync || !account) return
            set({ status: 'syncing' })
            try {
                const pulled = await sync.pull(
                    readStorage(cursorKey(account)) || null,
                )
                if (pulled.cursor)
                    writeStorage(cursorKey(account), pulled.cursor)
                await sync.pushPending()
                await useLibraryStore.getState().load()
                const known = new Set(get().tombstones.map((t) => t.localId))
                set({
                    status: 'idle',
                    error: null,
                    lastSyncedAt: Date.now(),
                    tombstones: [
                        ...get().tombstones,
                        ...pulled.tombstones.filter(
                            (t) => !known.has(t.localId),
                        ),
                    ],
                })
            } catch (e) {
                fail(e)
            }
        },

        resolveConflict: async (localId, choice) => {
            const account = accountId()
            const sync = account ? await engineFor(account) : null
            if (!sync) return
            try {
                await sync.resolve(localId, choice)
                await useLibraryStore.getState().load()
            } catch (e) {
                fail(e)
            }
        },

        settleTombstone: async (localId, keep) => {
            const account = accountId()
            const sync = account ? await engineFor(account) : null
            if (keep && sync) await sync.keepLocal(localId)
            if (!keep) await libraryRepository.remove(localId)
            set({
                tombstones: get().tombstones.filter(
                    (t) => t.localId !== localId,
                ),
            })
            await useLibraryStore.getState().load()
        },

        removeEverywhere: async (localId) => {
            const account = accountId()
            const sync = account ? await engineFor(account) : null
            if (!sync) throw new Error('Sign in to delete from the cloud')
            await sync.removeCloud(localId)
            await useLibraryStore.getState().remove(localId)
        },

        removeCloudCopies: async () => {
            const account = accountId()
            if (!account) return
            const library = useLibraryStore.getState()
            for (const e of library.entries)
                if (e.sync.accountId === account && e.sync.itemId)
                    await libraryRepository.remove(e.localId)
            writeStorage(cursorKey(account), '')
            await library.load()
        },

        refreshQuota: async () => {
            const client = await getCloudClient()
            if (!client || !accountId()) return
            const [usage, plan] = await Promise.all([
                client.rpc('my_usage'),
                client.rpc('my_plan'),
            ])
            const error = usage.error ?? plan.error
            if (error) {
                log.error('quota read failed', cloudErrorMessage(error))
                return
            }
            const used =
                (usage.data as { cloud_private_items?: number } | null)
                    ?.cloud_private_items ?? 0
            const limit =
                (
                    plan.data as {
                        limits?: { cloud_private_items?: number }
                    } | null
                )?.limits?.cloud_private_items ?? 0
            set({ quota: { used, limit } })
        },

        cloudCopy: async (localId) => {
            const account = accountId()
            const sync = account ? await engineFor(account) : null
            return sync ? sync.cloudCopy(localId) : null
        },
    }
})

export default useSyncStore
