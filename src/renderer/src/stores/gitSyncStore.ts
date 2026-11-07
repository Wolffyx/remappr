// Pattern check: no GoF pattern (-) — rejected — a zustand store wiring the
// git sync engine to the real stores, the GitHub token and the cloud (DI via
// createGitSync), plus its triggers; mirrors syncStore.
//
// GitHub sync of library entries (plan §6c A2, P10f). No account needed: the
// link lives on the entry. Triggers:
// - a saved version of a linked entry with auto push: push it (1.5 s later);
// - window focus (at most once a minute), every 5 minutes, back online:
//   pull every linked entry and push what waits.
// A signed-in, synced entry also mirrors its link to `item_git_links`, so the
// owner's other devices pick it up.
import { create } from 'zustand'
import { toast } from 'sonner'
import { createLogger } from '@shared/logger'
import { getCloudClient } from '@/lib/cloud/client'
import { APP_VERSION } from '@/lib/constants'
import { getGithubToken } from '@/lib/github/connection'
import {
    createGitSync,
    syncErrorText,
    type ConflictChoice,
    type HandEditChoice,
    type PullResult,
} from '@/lib/github/gitSync/engine'
import { slugOf } from '@/lib/github/gitSync/layout'
import { createRepoApi } from '@/lib/github/repoApi'
import { entryFromSource } from '@/lib/library/entries'
import type { GitLink, LibraryEntry } from '@/lib/library/types'
import useAuthStore from '@/stores/authStore'
import useHistoryStore, { historyRepository } from '@/stores/historyStore'
import useLibraryStore from '@/stores/libraryStore'

const log = createLogger('GitSync')
const PULL_EVERY_MS = 5 * 60_000
const FOCUS_MIN_GAP_MS = 60_000
const AUTO_PUSH_DELAY_MS = 1500

export interface LinkSettings {
    repo: string
    branch: string
    folder: string
    target: string | null
    autoPush: boolean
}

export interface GitSyncState {
    /** Entries with a GitHub call running. */
    busy: Record<string, boolean>
    link: (localId: string, settings: LinkSettings) => Promise<void>
    /** Change auto push or the target (same remote). */
    configure: (
        localId: string,
        changes: Partial<Pick<LinkSettings, 'autoPush' | 'target'>>,
    ) => Promise<void>
    unlink: (localId: string) => Promise<void>
    /** Pull, then push saved versions and unsaved edits. */
    syncNow: (localId: string) => Promise<void>
    pull: (localId: string) => Promise<PullResult>
    resolveConflict: (localId: string, choice: ConflictChoice) => Promise<void>
    resolveHandEdits: (localId: string, choice: HandEditChoice) => Promise<void>
    start: () => void
}

const entryOf = (localId: string): LibraryEntry | undefined =>
    useLibraryStore.getState().entries.find((e) => e.localId === localId)

const linked = (): LibraryEntry[] =>
    useLibraryStore.getState().entries.filter((e) => e.git)

/** The cloud item this device may mirror the link to, if any. */
function cloudItem(entry: LibraryEntry): string | null {
    const uid = useAuthStore.getState().user?.id
    if (!uid || !entry.sync.itemId || entry.sync.accountId !== uid) return null
    return entry.sync.itemId
}

async function mirror(
    entry: LibraryEntry,
    link: GitLink | null,
): Promise<void> {
    const item = cloudItem(entry)
    const client = item ? await getCloudClient() : null
    if (!item || !client) return
    const { error } = await client.rpc('set_git_link', {
        p_item: item,
        p_link: link && {
            repo: link.repo,
            slug: link.slug,
            branch: link.branch,
            folder: link.folder,
            target: link.target,
            auto_push: link.autoPush,
        },
    })
    if (error) log.warn('could not store the GitHub link in the cloud', error)
}

const engine = createGitSync({
    api: async () => {
        const token = await getGithubToken()
        return token ? createRepoApi(token) : null
    },
    entry: entryOf,
    saveLink: (localId, link) =>
        useLibraryStore.getState().setGit(localId, link),
    versions: (localId) => historyRepository.list(localId),
    putVersion: async (v) => {
        await historyRepository.put(v)
        await useHistoryStore.getState().load(v.localId)
    },
    applyGithub: (localId, source, message, sha) =>
        useHistoryStore
            .getState()
            .applyGithub(
                localId,
                { name: entryOf(localId)?.name ?? '', source },
                message,
                sha,
            ),
    saveCopy: async (localId, source) => {
        const e = entryOf(localId)
        if (!e) return
        const built = entryFromSource(e.kind, source, e.type, e.extra)
        await useLibraryStore
            .getState()
            .save({ ...built, source, name: `${e.name} (GitHub)` })
    },
    markCloud: async (entry, version, sha) => {
        const item = cloudItem(entry)
        const client = item ? await getCloudClient() : null
        if (!item || !client) return
        const { error } = await client.rpc('mark_git_synced', {
            p_item: item,
            p_sha: sha,
            ...(version ? { p_version: version } : {}),
        })
        if (error) throw error
    },
    generator: `remappr@${APP_VERSION}`,
    now: () => Date.now(),
})

/** Links the owner made on another device, for synced entries with none. */
async function adoptCloudLinks(): Promise<void> {
    const client = await getCloudClient()
    if (!client || !useAuthStore.getState().user) return
    const { data, error } = await client
        .from('item_git_links')
        .select(
            'item_id, repo, slug, branch, folder, target, auto_push, last_synced_sha',
        )
    if (error) {
        log.warn('could not read GitHub links from the cloud', error)
        return
    }
    const byItem = new Map(data.map((r) => [r.item_id, r]))
    for (const e of useLibraryStore.getState().entries) {
        const row = e.sync.itemId ? byItem.get(e.sync.itemId) : undefined
        if (!row || e.git || !cloudItem(e)) continue
        const versions = await historyRepository.list(e.localId)
        await useLibraryStore.getState().setGit(e.localId, {
            repo: row.repo,
            slug: row.slug,
            branch: row.branch,
            folder: row.folder,
            target: row.target,
            autoPush: row.auto_push,
            linkedAt: versions.at(-1)?.n ?? 0,
            lastSyncedSha: row.last_synced_sha ?? undefined,
        })
    }
}

const useGitSyncStore = create<GitSyncState>()((set, get) => {
    let started = false
    let lastFocus = 0
    const timers = new Map<string, ReturnType<typeof setTimeout>>()

    const withBusy = async <T>(
        localId: string,
        task: () => Promise<T>,
    ): Promise<T> => {
        set({ busy: { ...get().busy, [localId]: true } })
        try {
            return await task()
        } finally {
            const rest = { ...get().busy }
            delete rest[localId]
            set({ busy: rest })
        }
    }

    const announce = (localId: string, result: PullResult): void => {
        const name = entryOf(localId)?.name ?? 'An entry'
        if (result === 'applied')
            toast.info(`${name}: took the newer version from GitHub`)
        if (result === 'conflict')
            toast.warning(`${name} changed here and on GitHub`, {
                description: 'Open its History to choose which to keep.',
                duration: 10000,
            })
        if (result === 'removed')
            toast.warning(`${name} was removed from GitHub`, {
                description: 'The next sync writes it there again.',
            })
    }

    /** Pull every linked entry and push what waits (quietly: state shows it). */
    const sweep = async (): Promise<void> => {
        if (!(await getGithubToken())) return
        for (const e of linked()) {
            if (get().busy[e.localId]) continue
            await withBusy(e.localId, async () => {
                const before = e.git?.state
                await engine.push(e.localId)
                const after = entryOf(e.localId)?.git?.state
                if (after === 'conflict' && before !== 'conflict')
                    announce(e.localId, 'conflict')
            }).catch((err: unknown) =>
                log.warn(`git sync of ${e.name} failed`, err),
            )
        }
    }

    const pushSoon = (localId: string): void => {
        clearTimeout(timers.get(localId))
        timers.set(
            localId,
            setTimeout(() => {
                timers.delete(localId)
                void withBusy(localId, () => engine.push(localId)).catch(
                    (err: unknown) => log.warn('auto push failed', err),
                )
            }, AUTO_PUSH_DELAY_MS),
        )
    }

    return {
        busy: {},
        link: async (localId, settings) => {
            const e = entryOf(localId)
            if (!e) return
            const versions = await historyRepository.list(localId)
            const link: GitLink = {
                ...settings,
                slug: slugOf(e.name),
                linkedAt: versions.at(-1)?.n ?? 0,
                state: 'ahead',
            }
            await useLibraryStore.getState().setGit(localId, link)
            await mirror(e, link)
            await get().syncNow(localId)
        },
        configure: async (localId, changes) => {
            const e = entryOf(localId)
            if (!e?.git) return
            const link = { ...e.git, ...changes }
            await useLibraryStore.getState().setGit(localId, link)
            await mirror(e, link)
        },
        unlink: async (localId) => {
            const e = entryOf(localId)
            if (!e) return
            await useLibraryStore.getState().setGit(localId, null)
            await mirror(e, null)
        },
        syncNow: (localId) =>
            withBusy(localId, async () => {
                await engine.push(localId, { head: true })
                const state = entryOf(localId)?.git?.state
                if (state === 'conflict') announce(localId, 'conflict')
            }),
        pull: (localId) =>
            withBusy(localId, async () => {
                const result = await engine.pull(localId)
                announce(localId, result)
                return result
            }),
        resolveConflict: (localId, choice) =>
            withBusy(localId, () => engine.resolveConflict(localId, choice)),
        resolveHandEdits: (localId, choice) =>
            withBusy(localId, () => engine.resolveHandEdits(localId, choice)),
        start: () => {
            if (started) return
            started = true
            // A new saved version of a linked entry: push it.
            useHistoryStore.subscribe((s, prev) => {
                if (s.versions === prev.versions) return
                for (const [localId, list] of Object.entries(s.versions)) {
                    if (list === prev.versions[localId]) continue
                    const e = entryOf(localId)
                    const last = list.at(-1)
                    if (
                        e?.git?.autoPush &&
                        last?.kind === 'checkpoint' &&
                        !last.gitSha
                    )
                        pushSoon(localId)
                }
            })
            useAuthStore.subscribe((s, prev) => {
                if (s.user?.id && s.user.id !== prev.user?.id)
                    void adoptCloudLinks().then(sweep)
            })
            window.addEventListener('focus', () => {
                if (Date.now() - lastFocus < FOCUS_MIN_GAP_MS) return
                lastFocus = Date.now()
                void sweep()
            })
            window.addEventListener('online', () => void sweep())
            setInterval(() => void sweep(), PULL_EVERY_MS)
            void useLibraryStore
                .getState()
                .load()
                .then(adoptCloudLinks)
                .then(sweep)
        },
    }
})

export { syncErrorText }
export default useGitSyncStore
