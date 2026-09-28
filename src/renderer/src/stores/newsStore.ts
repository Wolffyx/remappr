// Pattern check: no GoF pattern (-) — rejected — zustand persisted store with a staleness-gated refresh, same shape as the other stores in src/renderer/src/stores.
//
// Start-page news: both sources (see features/news/newsModel.ts) cached in
// localStorage, plus what the user has read or dismissed. The bundled
// news.json is the first-run / offline content until a fetch lands.
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import bundledNews from '../../../../docs/public/news.json'
import { NEWS_URL } from '@/lib/constants'
import { getRecentReleases } from '@/lib/github'
import {
    type NewsItem,
    parseNewsFile,
    releaseToNewsItem,
} from '@/features/news/newsModel'

// GitHub allows 60 unauthenticated API calls an hour per IP; one refresh per
// half hour stays well under it.
const STALE_MS = 30 * 60_000
const RELEASE_COUNT = 10
// Read ids only matter for recent items, so the list never needs to grow.
const READ_IDS_KEPT = 200

interface NewsState {
    curated: NewsItem[]
    /** `curated` came from the remote news.json. Only then is it cached; the
     *  bundled copy is re-read on every start so edits to it show up. */
    curatedFromRemote: boolean
    releases: NewsItem[]
    /** When the last refresh finished (ms), 0 = never. */
    fetchedAt: number
    readIds: string[]
    /** Pinned items the banner was dismissed on; a newly pinned item shows
     *  the banner again. */
    dismissedBannerIds: string[]
    /** Item whose release notes dialog is open (not persisted). */
    notesItemId: string | null
    /** Fetch both sources unless the cache is under half an hour old. A source
     *  that fails keeps its cached items. */
    refresh: () => Promise<void>
    markRead: (ids: string[]) => void
    dismissBanner: (ids: string[]) => void
    resetBanner: () => void
    openNotes: (id: string) => void
    closeNotes: () => void
}

async function fetchCurated(): Promise<NewsItem[]> {
    const res = await fetch(NEWS_URL)
    if (!res.ok) throw new Error(`news.json: HTTP ${res.status}`)
    return parseNewsFile(await res.json())
}

async function fetchReleases(): Promise<NewsItem[]> {
    const releases = await getRecentReleases(RELEASE_COUNT)
    return releases.flatMap((r) => {
        const item = releaseToNewsItem(r)
        return item ? [item] : []
    })
}

let inFlight: Promise<void> | null = null

const useNewsStore = create<NewsState>()(
    persist(
        (set, get) => ({
            curated: parseNewsFile(bundledNews),
            curatedFromRemote: false,
            releases: [],
            fetchedAt: 0,
            readIds: [],
            dismissedBannerIds: [],
            notesItemId: null,
            refresh: () => {
                if (Date.now() - get().fetchedAt < STALE_MS) {
                    return Promise.resolve()
                }
                inFlight ??= (async () => {
                    const [curated, releases] = await Promise.allSettled([
                        fetchCurated(),
                        fetchReleases(),
                    ])
                    const patch: Partial<NewsState> = { fetchedAt: Date.now() }
                    if (curated.status === 'fulfilled') {
                        patch.curated = curated.value
                        patch.curatedFromRemote = true
                    } else {
                        console.warn(
                            '[news] news.json fetch failed:',
                            curated.reason,
                        )
                    }
                    if (releases.status === 'fulfilled') {
                        patch.releases = releases.value
                    } else {
                        console.warn(
                            '[news] releases fetch failed:',
                            releases.reason,
                        )
                    }
                    set(patch)
                })().finally(() => {
                    inFlight = null
                })
                return inFlight
            },
            markRead: (ids) =>
                set((s) => ({
                    readIds: [...new Set([...s.readIds, ...ids])].slice(
                        -READ_IDS_KEPT,
                    ),
                })),
            dismissBanner: (ids) =>
                set((s) => ({
                    dismissedBannerIds: [
                        ...new Set([...s.dismissedBannerIds, ...ids]),
                    ],
                })),
            resetBanner: () => set({ dismissedBannerIds: [] }),
            openNotes: (id) => set({ notesItemId: id }),
            closeNotes: () => set({ notesItemId: null }),
        }),
        {
            name: 'news-store',
            storage: createJSONStorage(() => localStorage),
            version: 3,
            // v3: release items carry their full notes, and curated items are
            // only cached from a remote fetch. Drop both caches and refetch.
            migrate: (persisted: unknown, version: number) => {
                const p = { ...(persisted ?? {}) } as Partial<NewsState>
                if (version < 3) {
                    delete p.curated
                    p.releases = []
                    p.fetchedAt = 0
                }
                return p
            },
            partialize: (s) => ({
                ...(s.curatedFromRemote
                    ? { curated: s.curated, curatedFromRemote: true }
                    : {}),
                releases: s.releases,
                fetchedAt: s.fetchedAt,
                readIds: s.readIds,
                dismissedBannerIds: s.dismissedBannerIds,
            }),
        },
    ),
)

export default useNewsStore
